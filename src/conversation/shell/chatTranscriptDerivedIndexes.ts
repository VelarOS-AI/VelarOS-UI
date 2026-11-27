import type { ConversationMessageRunMarker, ConversationRunMarkerStatus } from '../projection'

import type { ChatMessage } from '#contracts'
import { isConversationTurnInputMessage } from '#contracts'
import { toNullable } from '#internal/runtime'

export interface ChatTranscriptDerivedIndexesInput {
  messages: readonly ChatMessage[]
  messageRunMarkerMap: ReadonlyMap<string, ConversationMessageRunMarker>
}

export interface ChatTranscriptDerivedIndexes {
  latestAssistantMessage: Nullable<ChatMessage>
  /**
   * 最近一条助手消息之后是否已经出现新的用户输入（新一轮已发出、助手还没开口）。
   * 此时任何运行/结果提示都属于新的一轮，不能再挂到上一轮的助手消息上——那条消息在新输入的上方。
   */
  hasTurnInputAfterLatestAssistant: boolean
  latestCompletedAssistantMessage: Nullable<ChatMessage>
  latestCompletedAssistantMessageId: Nullable<string>
  assistantQuestionMap: Map<string, ChatMessage>
}

export function isRunPausedMarkerStatus(status: LooseOptional<ConversationRunMarkerStatus>): boolean {
  return status === 'awaiting-confirmation' || status === 'awaiting-input'
}

export function isRunEndMarkerStatus(status: LooseOptional<ConversationRunMarkerStatus>): boolean {
  return !!status && !isRunPausedMarkerStatus(status)
}

export function resolveActiveTranscriptAssistantMessageId({
  isRunActive,
  streamingAssistantMessageId,
  latestAssistantMessageId,
  latestAssistantRunMarker,
  hasTurnInputAfterLatestAssistant = false,
}: {
  isRunActive: boolean
  streamingAssistantMessageId?: LooseOptional<string>
  latestAssistantMessageId?: LooseOptional<string>
  latestAssistantRunMarker?: LooseOptional<Pick<ConversationMessageRunMarker, 'status'>>
  hasTurnInputAfterLatestAssistant?: boolean
}): Nullable<string> {
  if (!isRunActive) return null
  if (streamingAssistantMessageId && streamingAssistantMessageId !== latestAssistantMessageId)
    return streamingAssistantMessageId
  // 上一条助手已经收尾，或其后已有独立输入。新执行还没有助手消息时由列表尾部承载提示。
  if (hasTurnInputAfterLatestAssistant || isRunEndMarkerStatus(latestAssistantRunMarker?.status))
    return null

  return toNullable(latestAssistantMessageId)
}

export function buildChatTranscriptDerivedIndexes({
  messages,
  messageRunMarkerMap,
}: ChatTranscriptDerivedIndexesInput): ChatTranscriptDerivedIndexes {
  const assistantQuestionMap = new Map<string, ChatMessage>()

  let latestAssistantMessage: Nullable<ChatMessage> = null
  let latestCompletedAssistantMessage: Nullable<ChatMessage> = null
  let latestUserMessage: Nullable<ChatMessage> = null
  let hasTurnInputAfterLatestAssistant = false

  for (const message of messages) {
    if (isConversationTurnInputMessage(message)) {
      latestUserMessage = message
      hasTurnInputAfterLatestAssistant = true
      continue
    }

    if (message.role === 'user') continue

    latestAssistantMessage = message
    hasTurnInputAfterLatestAssistant = false

    if (latestUserMessage) {
      assistantQuestionMap.set(message.id, latestUserMessage)
    }

    const marker = messageRunMarkerMap.get(message.id)

    if (marker?.status === 'completed') {
      latestCompletedAssistantMessage = message
    }
  }

  return {
    latestAssistantMessage,
    hasTurnInputAfterLatestAssistant,
    latestCompletedAssistantMessage,
    latestCompletedAssistantMessageId: toNullable(latestCompletedAssistantMessage?.id),
    assistantQuestionMap,
  }
}
