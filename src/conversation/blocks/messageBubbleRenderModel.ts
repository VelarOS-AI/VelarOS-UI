import {
  type ConversationTranslator,
  conversationTranslatorRuntime,
} from '../i18n/conversationTranslator'
import type { ConversationMessageRunMarker } from '../projection'
import type { ChatInlineNoticeMeta } from '../status/chatStatus'
import {
  isToolActivitySummaryExcludedToolCall,
  type ToolActivitySummaryExclusionPredicate,
  type ToolRenderSegment,
} from '../tool-render/toolCallRenderGrouping'
import { formatToolDurationMs } from '../tool-render/toolCallSummary'

import { formatMessageCostEstimate } from './messageCostEstimate'
import { formatExactNumber } from './numberFormat'

import type {
  AppLocale,
  ChatAttachmentMeta,
  ChatMessage,
  ContentBlock,
  SerializedImageAttachment,
  TextBlock,
  ToolCallBlock as ToolCallBlockType,
} from '#contracts'
import { isBlank, isEmpty, isFalse, isFiniteNumber, isPresent, optionalWhenLazy } from '#internal/runtime'

/**
 * `ConversationMessageRunMarker` 现住投影层（`../projection`）——气泡渲染模型 + memo 比较器 + transcript
 * 派生共用；此处再导出，既有 blocks 消费者继续从本模块引入不受影响。
 */
export type { ConversationMessageRunMarker } from '../projection'

export type MessageRenderSegment =
  | {
      kind: 'activity-group'
      key: string
      segments: ToolRenderSegment[]
      blocks: ToolCallBlockType[]
    }
  | { kind: 'segment'; key: string; segment: ToolRenderSegment }

export interface MessageRenderSegmentOptions {
  isToolActivitySummaryExcludedToolCall?: ToolActivitySummaryExclusionPredicate
}

export interface VisibleMessageBlockOptions {
  /** 纯展示过滤：false 时保留消息数据，只从当前渲染树移除 thinking block。 */
  showThinkingProcess?: boolean
}

export interface GoalCompletionActivitySummary {
  durationMs: Nullable<number>
  totalTokens: Nullable<number>
  costUsd: Nullable<number>
  /** 有调用没回报用量或查不到价格：`costUsd` 只是下限，展示时加「≥」。 */
  costIsLowerBound?: boolean
}

export interface ProcessedActivityDisclosureLabelOptions {
  goalCompletionSummary?: LooseOptional<GoalCompletionActivitySummary>
  responseDurationMs?: LooseOptional<number>
  isRunning?: boolean
}

export interface ProcessedActivitySummaryBoundaryOptions {
  allowTrailingActivity?: boolean
}

export interface ProcessedActivitySummaryBoundarySignalOptions {
  isStreaming: boolean
  runMarker?: LooseOptional<Pick<ConversationMessageRunMarker, 'status' | 'turnKind'>>
}

export interface ProcessedActivitySummaryPartition {
  processedSegments: MessageRenderSegment[]
  outsideSegments: MessageRenderSegment[]
  trailingSegments: MessageRenderSegment[]
}

export interface AssistantGeneratedArtifactsVisibilityOptions {
  isStreaming: boolean
  /** 这条消息所属的执行还没停（同一次执行后面还在流式，或停在等待作答上）。 */
  runInProgress?: boolean
  runMarker?: LooseOptional<Pick<ConversationMessageRunMarker, 'status'>>
}

/**
 * 回答的收尾件（复制与时间、文件改动汇总、动作行、生成物）只在这条消息所属的执行停下之后出现。
 *
 * 只看本条是否流式、有没有标记不够：运行标记只写在一次执行的最后一条助手消息上，执行中途的助手消息
 * 既不在流式、也没有标记，照旧判据会在运行还没结束时就露出收尾件。所以本条流式、或同一次执行还在往后跑
 * 都不出现；带标记的只在正常完成时出现；既没标记、执行也不在进行（历史、不写标记的宿主）时照常出现。
 */
export function shouldShowAssistantGeneratedArtifacts({
  isStreaming,
  runInProgress = false,
  runMarker,
}: AssistantGeneratedArtifactsVisibilityOptions): boolean {
  if (isStreaming || runInProgress) return false
  if (!runMarker) return true

  return runMarker.status === 'completed'
}

function isResponseDurationTimestamp(value: LooseOptional<number>): value is number {
  return isFiniteNumber(value) && value >= 0
}

export function shouldUseProcessedActivitySummaryBoundary({
  isStreaming,
  runMarker,
}: ProcessedActivitySummaryBoundarySignalOptions): boolean {
  if (isStreaming) return false
  if (runMarker?.status === 'awaiting-confirmation' || runMarker?.status === 'awaiting-input')
    return false

  return runMarker?.status === 'completed'
}

export function getAssistantResponseDurationMs(options: {
  questionMessage?: LooseOptional<Pick<ChatMessage, 'timestamp'>>
  runMarker?: LooseOptional<Pick<ConversationMessageRunMarker, 'status' | 'timestamp'>>
  isStreaming?: boolean
}): Nullable<number> {
  if (options.isStreaming) return null

  const startedAt = options.questionMessage?.timestamp
  if (!isResponseDurationTimestamp(startedAt)) return null

  const runMarker = options.runMarker
  if (!runMarker) return null

  if (runMarker.status === 'awaiting-input' || runMarker.status === 'awaiting-confirmation')
    return null

  const finishedAt = runMarker.timestamp
  if (!isResponseDurationTimestamp(finishedAt)) return null

  return Math.max(0, finishedAt - startedAt)
}

function getTextBlockTone(block: TextBlock): NonNullable<TextBlock['tone']> {
  return block.tone ?? 'default'
}

function coalesceTextBlocksAcrossThinking(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = []

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (!block) continue

    if (block.type !== 'text') {
      result.push(block)
      continue
    }

    let textBlock: TextBlock = block
    const deferredThinkingBlocks: ContentBlock[] = []
    let cursor = index + 1

    for (; cursor < blocks.length; cursor += 1) {
      const nextBlock = blocks[cursor]
      if (!nextBlock) continue

      if (nextBlock.type === 'thinking') {
        deferredThinkingBlocks.push(nextBlock)
        continue
      }

      if (
        nextBlock.type === 'text' &&
        nextBlock.segmentId === textBlock.segmentId &&
        nextBlock.turnId === textBlock.turnId &&
        getTextBlockTone(nextBlock) === getTextBlockTone(textBlock)
      ) {
        textBlock = {
          ...textBlock,
          text: textBlock.text + nextBlock.text,
        }
        continue
      }

      break
    }

    result.push(textBlock, ...deferredThinkingBlocks)
    index = cursor - 1
  }

  return result
}

export function extractMessageText(message: ChatMessage): string {
  let result = ''

  for (const block of message.blocks) {
    if (block.type !== 'text') continue

    const text = block.text.trimEnd()
    if (isBlank(text)) continue

    result = result ? `${result}\n\n${text}` : text
  }

  return result.trim()
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMessageTime(timestamp: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatMessageDateTime(timestamp: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function buildImageAttachmentSrc(attachment: SerializedImageAttachment): string {
  return `data:${attachment.mediaType || 'image/png'};base64,${attachment.data}`
}

export function getVisibleMessageBlocks(
  message: ChatMessage,
  showToolDetails: boolean,
  options: VisibleMessageBlockOptions = {}
): ContentBlock[] {
  const visibleBlocks: ContentBlock[] = []
  message.blocks.forEach((block) => {
    if (isFalse(options.showThinkingProcess) && block.type === 'thinking') return
    // 工具调用与脚本执行都是执行过程的细节，跟随同一个开关。
    if (block.type !== 'tool-call' && block.type !== 'script-execution') {
      visibleBlocks.push(block)
      return
    }

    if (showToolDetails) visibleBlocks.push(block)
  })

  return coalesceTextBlocksAcrossThinking(visibleBlocks)
}

export function hasVisibleSegmentContent(segment: ToolRenderSegment): boolean {
  switch (segment.block.type) {
    case 'tool-call':
    case 'script-execution':
    case 'interaction':
    case 'widget':
      return true
    case 'text':
      return !isBlank(segment.block.text)
    default:
      return false
  }
}

/** 给用户看的成品不收进「已处理」：交互卡（问了什么、答了什么）、小部件，以及摘出来单独展示的工具调用。 */
export function shouldRenderSegmentOutsideProcessedActivityDisclosure(
  segment: MessageRenderSegment
): boolean {
  if (segment.kind !== 'segment') return false

  const { block } = segment.segment
  switch (block.type) {
    case 'tool-call':
      return isToolActivitySummaryExcludedToolCall(block)
    case 'interaction':
    case 'widget':
      return true
    default:
      return false
  }
}

/**
 * 最终答复前的工具活动只能形成一个「已处理」分组。需要外置的成品卡从分组中提取，
 * 统一排在该分组下方；这样插入计划卡、Widget 或交互卡时不会把「已处理」切成两段。
 */
export function partitionProcessedActivitySummarySegments(
  segments: MessageRenderSegment[],
  summaryBoundaryIndex: number
): ProcessedActivitySummaryPartition {
  const processedSegments: MessageRenderSegment[] = []
  const outsideSegments: MessageRenderSegment[] = []
  const trailingSegments: MessageRenderSegment[] = []
  const boundary = Math.max(0, Math.min(summaryBoundaryIndex, segments.length))

  for (let index = 0; index < boundary; index += 1) {
    const segment = segments[index]
    if (!segment) continue

    if (shouldRenderSegmentOutsideProcessedActivityDisclosure(segment)) {
      outsideSegments.push(segment)
      continue
    }

    processedSegments.push(segment)
  }

  for (let index = boundary; index < segments.length; index += 1) {
    const segment = segments[index]
    if (!segment) continue

    // 续答或块合并有时会把已经结束的思考过程延后到最终正文之后。
    // 完成态下将这类孤立思考重新归入唯一的「已处理」分组，正文和成品卡仍留在外面。
    if (summaryBoundaryIndex >= 0 && messageSegmentIsThinking(segment)) {
      processedSegments.push(segment)
      continue
    }

    trailingSegments.push(segment)
  }

  return {
    processedSegments,
    outsideSegments,
    trailingSegments,
  }
}

function findLastVisibleToolRenderSegment(
  segments: ToolRenderSegment[]
): ToolRenderSegment | undefined {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (segment && hasVisibleSegmentContent(segment)) return segment
  }

  return undefined
}

export function getStreamingTextSegmentKey(segments: ToolRenderSegment[]): string | undefined {
  const tailSegment = findLastVisibleToolRenderSegment(segments)

  return optionalWhenLazy(tailSegment?.block.type === 'text', () => tailSegment!.key)
}

export function getLastTextSegmentKey(segments: readonly ToolRenderSegment[]): string | undefined {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (segment?.block.type === 'text' && !isBlank(segment.block.text)) return segment.key
  }

  return undefined
}

/** 能进「调用了 N 次工具」活动组的段：没被摘出来单独展示的工具调用。脚本执行卡从不进组。 */
function getGroupedToolBlock(
  segment: ToolRenderSegment,
  isExcludedToolCall: ToolActivitySummaryExclusionPredicate
): Nullable<ToolCallBlockType> {
  const { block } = segment
  return block.type === 'tool-call' && !isExcludedToolCall(block) ? block : null
}

export function buildMessageRenderSegments(
  segments: ToolRenderSegment[],
  options: MessageRenderSegmentOptions = {}
): MessageRenderSegment[] {
  const messageSegments: MessageRenderSegment[] = []
  let pendingSegments: ToolRenderSegment[] = []
  let pendingBlocks: ToolCallBlockType[] = []
  const isExcludedToolCall =
    options.isToolActivitySummaryExcludedToolCall ?? isToolActivitySummaryExcludedToolCall

  const flushPendingSegments = (): void => {
    if (isEmpty(pendingSegments)) return

    messageSegments.push({
      kind: 'activity-group',
      key: `activity:${pendingBlocks[0]?.toolCallId ?? pendingSegments[0].key}`,
      segments: pendingSegments,
      blocks: pendingBlocks,
    })
    pendingSegments = []
    pendingBlocks = []
  }

  segments.forEach((segment) => {
    const toolBlock = getGroupedToolBlock(segment, isExcludedToolCall)

    if (toolBlock) {
      pendingSegments.push(segment)
      pendingBlocks.push(toolBlock)
      return
    }

    flushPendingSegments()
    messageSegments.push({
      kind: 'segment',
      key: segment.key,
      segment,
    })
  })

  flushPendingSegments()
  return messageSegments
}

function messageSegmentHasStartedText(segment: MessageRenderSegment): boolean {
  return (
    segment.kind === 'segment' &&
    segment.segment.block.type === 'text' &&
    !isBlank(segment.segment.block.text)
  )
}

function messageSegmentIsThinking(segment: MessageRenderSegment): boolean {
  return (
    segment.kind === 'segment' &&
    segment.segment.block.type === 'thinking' &&
    !isBlank(segment.segment.block.text)
  )
}

function messageRenderSegmentHasVisibleContent(segment: MessageRenderSegment): boolean {
  if (segment.kind === 'activity-group') return segment.segments.some(hasVisibleSegmentContent)

  return hasVisibleSegmentContent(segment.segment)
}

function messageRenderSegmentIsTrailingActivity(segment: MessageRenderSegment): boolean {
  return (
    (segment.kind === 'activity-group' && !isEmpty(segment.blocks)) ||
    messageSegmentIsThinking(segment)
  )
}

export function getProcessedActivitySummaryBoundaryIndex(
  segments: MessageRenderSegment[],
  options: ProcessedActivitySummaryBoundaryOptions = {}
): number {
  let summaryTextIndex = -1

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (!segment || !messageRenderSegmentHasVisibleContent(segment)) {
      continue
    }

    if (messageSegmentHasStartedText(segment)) {
      summaryTextIndex = index
      break
    }

    // 完成态正文后出现思考块属于异常尾巴；始终允许越过它寻找最终正文边界，
    // 后续 partition 会把它兜底搬回「已处理」。普通尾部工具活动仍沿用显式开关。
    if (
      messageSegmentIsThinking(segment) ||
      (options.allowTrailingActivity && messageRenderSegmentIsTrailingActivity(segment))
    ) {
      continue
    }

    return -1
  }

  if (summaryTextIndex < 0) return -1

  return summaryTextIndex
}


function formatGoalCompletionActivityLabel(
  summary: GoalCompletionActivitySummary,
  locale: AppLocale,
  translatorRuntime: ConversationTranslator
): string {
  const conversationTranslate = translatorRuntime.translate
  const details: string[] = []

  if (isFiniteNumber(summary.durationMs)) {
    details.push(
      conversationTranslate(locale, 'chat.goalCompletedDuration', {
        duration: formatToolDurationMs(summary.durationMs, locale, translatorRuntime),
      })
    )
  }

  if (isFiniteNumber(summary.totalTokens)) {
    details.push(
      conversationTranslate(locale, 'chat.goalCompletedTokens', {
        tokens: formatExactNumber(locale, Math.max(0, Math.round(summary.totalTokens))),
      })
    )
  }

  if (isFiniteNumber(summary.costUsd)) {
    const cost = formatMessageCostEstimate(locale, Math.max(0, summary.costUsd))
    details.push(
      conversationTranslate(locale, 'chat.goalCompletedCost', {
        cost: summary.costIsLowerBound ? `≥${cost}` : cost,
      })
    )
  }

  if (isEmpty(details)) return conversationTranslate(locale, 'chat.goalCompleted')

  return conversationTranslate(locale, 'chat.goalCompletedWithDetails', {
    details: details.join(' · '),
  })
}

export function getProcessedActivityDisclosureLabel(
  blocks: Array<Pick<ToolCallBlockType, 'isRunning'>>,
  locale: AppLocale,
  options: ProcessedActivityDisclosureLabelOptions = {},
  translatorRuntime: ConversationTranslator = conversationTranslatorRuntime
): string {
  const conversationTranslate = translatorRuntime.translate
  if (options.goalCompletionSummary)
    return formatGoalCompletionActivityLabel(
      options.goalCompletionSummary,
      locale,
      translatorRuntime
    )

  const isRunning = options.isRunning || blocks.some((block) => block.isRunning)
  if (isRunning) return conversationTranslate(locale, 'chat.processedActivity')

  const responseDurationMs = options.responseDurationMs
  if (isPresent(responseDurationMs) && Math.max(0, Math.round(responseDurationMs)) > 0)
    return conversationTranslate(locale, 'chat.processedActivityWithDuration', {
      duration: formatToolDurationMs(responseDurationMs, locale, translatorRuntime),
    })

  return conversationTranslate(locale, 'chat.processedActivity')
}

/** 正文末尾画得出角标的运行状态：跑完、失败、中止。 */
export type SettledRunMarkerStatus = Exclude<
  ConversationMessageRunMarker['status'],
  'awaiting-confirmation' | 'awaiting-input'
>

/** 结束了的运行标记。 */
export type SettledRunMarker = ConversationMessageRunMarker & { status: SettledRunMarkerStatus }

/** 正文末尾的运行角标只画结束了的运行：等确认、等回答的时候卡片自己就在等，不再多画一个暂停标。 */
export function settledRunMarker(
  runMarker: LooseOptional<ConversationMessageRunMarker>
): Nullable<SettledRunMarker> {
  if (!runMarker || runMarker.status === 'awaiting-confirmation' || runMarker.status === 'awaiting-input')
    return null
  return runMarker as SettledRunMarker
}

export function areRunMarkersEqual(
  prev: LooseOptional<ConversationMessageRunMarker>,
  next: LooseOptional<ConversationMessageRunMarker>
): boolean {
  if (prev === next) return true

  if (!prev || !next) return prev === next

  return (
    prev.messageId === next.messageId &&
    prev.status === next.status &&
    prev.detail === next.detail &&
    prev.turnCount === next.turnCount &&
    prev.turnKind === next.turnKind &&
    prev.goalMode === next.goalMode &&
    prev.goalStatus === next.goalStatus &&
    prev.workspaceCheckpointDiff?.capturedAt === next.workspaceCheckpointDiff?.capturedAt &&
    prev.workspaceCheckpointDiff?.error === next.workspaceCheckpointDiff?.error &&
    prev.workspaceCheckpointDiff?.changes === next.workspaceCheckpointDiff?.changes &&
    prev.workspaceCheckpointDiff?.failedRoots === next.workspaceCheckpointDiff?.failedRoots &&
    prev.timestamp === next.timestamp
  )
}

export function areInlineNoticesEqual(
  prev: LooseOptional<ChatInlineNoticeMeta>,
  next: LooseOptional<ChatInlineNoticeMeta>
): boolean {
  if (prev === next) return true

  if (!prev || !next) return prev === next

  return prev.text === next.text && prev.tone === next.tone
}

export function buildPreviewItems(
  attachments: ChatAttachmentMeta[],
  imageAttachments: SerializedImageAttachment[]
): Array<{ id: string; src: string; alt: string; title: string; description: string }> {
  const imageAttachmentMap = new Map<string, SerializedImageAttachment>()
  for (const attachment of imageAttachments) {
    imageAttachmentMap.set(attachment.id, attachment)
  }
  const previewItems: Array<{
    id: string
    src: string
    alt: string
    title: string
    description: string
  }> = []

  for (const attachment of attachments) {
    if (attachment.kind !== 'image') continue

    const imageAttachment = imageAttachmentMap.get(attachment.id)
    if (!imageAttachment) continue

    previewItems.push({
      id: attachment.id,
      src: buildImageAttachmentSrc(imageAttachment),
      alt: attachment.name,
      title: attachment.name,
      description: formatAttachmentSize(attachment.size),
    })
  }

  return previewItems
}
