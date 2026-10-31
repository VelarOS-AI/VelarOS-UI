// 从当前运行的消息块读取活动说明；阶段只作兜底，历史轨迹不能冒充正在执行的动作。
import {
  type ConversationTranslator,
  conversationTranslatorRuntime,
} from '../i18n/conversationTranslator'
import { getToolActivitySummary } from '../tool-render/toolCallSummary'

import { type ChatStatusRuntime, getChatStatusMeta } from './chatStatus'
import { getThinkingStageLabel } from './thinkingStageLabel'

import type { AppLocale, ChatMessage } from '#contracts'
import { isPresent } from '#internal/runtime'

interface ChatLiveActivityOptions {
  runtime: ChatStatusRuntime
  message?: LooseOptional<ChatMessage>
  waitMessage?: LooseOptional<string>
  locale: AppLocale
  pathFormatter?: (path: string) => string
}

export function readConversationLiveActivity(
  { runtime, message, waitMessage, locale, pathFormatter }: ChatLiveActivityOptions,
  translator: ConversationTranslator = conversationTranslatorRuntime
): {
  liveTraceSummary: string
  hasStreamingThinkingBlock: boolean
} {
  const status = getChatStatusMeta(
    runtime.status === 'running' ? runtime : { ...runtime, teamPhase: null },
    locale,
    translator
  )
  const fallback = {
    liveTraceSummary: status.detail ?? status.label,
    hasStreamingThinkingBlock: false,
  }
  if (runtime.status !== 'running') return fallback
  if (waitMessage?.trim()) return { ...fallback, liveTraceSummary: waitMessage.trim() }
  if (isPresent(runtime.connectionRetryAttempt) || runtime.lastError) return fallback
  if (
    message?.role !== 'assistant' ||
    (isPresent(runtime.lastRunStartedAt) && message.timestamp < runtime.lastRunStartedAt)
  )
    return fallback

  const lastBlock = message.blocks.at(-1)
  const thinkingPhase = !isPresent(runtime.teamPhase) || runtime.teamPhase === 'researching'
  if (thinkingPhase && lastBlock?.type === 'thinking' && lastBlock.text.trim())
    return {
      liveTraceSummary: getThinkingStageLabel(lastBlock.text) ?? fallback.liveTraceSummary,
      hasStreamingThinkingBlock: true,
    }

  // 请求、上下文整理、收尾等明确阶段不能被上一回合尚未收齐的执行卡覆盖。
  if (
    isPresent(runtime.teamPhase) &&
    runtime.teamPhase !== 'executing' &&
    runtime.teamPhase !== 'executing-tool' &&
    runtime.teamPhase !== 'researching'
  )
    return fallback
  const activeBlock = message.blocks.findLast(
    (block) =>
      (block.type === 'script-execution' &&
        (block.status === 'running' || block.status === 'writing')) ||
      (block.type === 'tool-call' && block.isRunning)
  )
  const activity =
    activeBlock?.type === 'script-execution'
      ? activeBlock.title.trim()
      : activeBlock?.type === 'tool-call'
        ? activeBlock.title?.trim() ||
          getToolActivitySummary(activeBlock, locale, pathFormatter, translator)
        : undefined
  return {
    ...fallback,
    liveTraceSummary: activity || fallback.liveTraceSummary,
  }
}
