import React, {
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useConversationI18n, useConversationTranslatorRuntime } from '../i18n'
import { useConversationAutoCollapseHold } from '../react-hooks/conversationScrollFollow'
import type { ToolRenderSegment } from '../tool-render/toolCallRenderGrouping'

import {
  type ConversationMessageRunMarker,
  getAssistantResponseDurationMs,
  getProcessedActivityDisclosureLabel,
  getProcessedActivitySummaryBoundaryIndex,
  type GoalCompletionActivitySummary,
  type MessageRenderSegment,
  partitionProcessedActivitySummarySegments,
  settledRunMarker,
  shouldUseProcessedActivitySummaryBoundary,
} from './messageBubbleRenderModel'
import { MessageContentBlock } from './MessageContentBlock'
import { MessageStatusMarker } from './MessageStatusMarker'
import { ToolActivityDisclosure } from './MessageToolActivity'
import { StreamFadeViewContext, useStreamFadeViewState } from './streamTextFade'

import styles from './MessageBubble.module.css'

import type {
  ChatMessage,
  ContentBlock,
  ConversationStepBlock,
  ToolCallBlock as ToolCallBlockType,
} from '#contracts'
import { isBlank, isEmpty, isPresent } from '#internal/runtime'

interface MessageSegmentSuffixState {
  hasStartedTextAfter: boolean
  hasStartedToolActivityAfter: boolean
}

type ActivitySegmentRenderer = () => Nullable<ReactElement>

const EmptyMessageSegmentSuffixState: MessageSegmentSuffixState = {
  hasStartedTextAfter: false,
  hasStartedToolActivityAfter: false,
}

interface MessageStreamingState {
  messageId: string
  isStreaming: boolean
}

/** 流式状态变化时是否发起完成态自动收起：同一条消息从流式转为结束才发起；换了消息、开始流式都撤掉。 */
export function shouldRequestProcessedActivityAutoCollapse(
  previous: MessageStreamingState,
  next: MessageStreamingState
): boolean {
  return previous.messageId === next.messageId && previous.isStreaming && !next.isStreaming
}

function messageSegmentStartsText(segment: MessageRenderSegment): boolean {
  return (
    segment.kind === 'segment' &&
    segment.segment.block.type === 'text' &&
    !isBlank(segment.segment.block.text)
  )
}

function messageSegmentStartsThinking(segment: MessageRenderSegment): boolean {
  return (
    segment.kind === 'segment' &&
    segment.segment.block.type === 'thinking' &&
    !isBlank(segment.segment.block.text)
  )
}

function messageSegmentStartsToolActivity(segment: MessageRenderSegment): boolean {
  return segment.kind === 'activity-group' && !isEmpty(segment.blocks)
}

function buildMessageSegmentSuffixStates(
  segments: readonly MessageRenderSegment[]
): MessageSegmentSuffixState[] {
  const suffixStates: MessageSegmentSuffixState[] = []
  let hasStartedTextAfter = false
  let hasStartedToolActivityAfter = false

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    suffixStates[index] = {
      hasStartedTextAfter,
      hasStartedToolActivityAfter,
    }

    if (!segment) continue

    hasStartedTextAfter ||= messageSegmentStartsText(segment)
    hasStartedToolActivityAfter ||= messageSegmentStartsToolActivity(segment)
  }

  return suffixStates
}

export function shouldRenderActivityGroupDisclosure(
  segment: MessageRenderSegment
): boolean {
  return segment.kind === 'activity-group' && !isEmpty(segment.blocks)
}

/** 完成态「已处理」内部只有真正的折叠项参与连续横排；正文和卡片仍各自占行。 */
export function shouldGroupProcessedActivityDisclosure(segment: MessageRenderSegment): boolean {
  return (
    shouldRenderActivityGroupDisclosure(segment) || messageSegmentStartsThinking(segment)
  )
}

export function shouldAnimateLiveToolActivity({
  armedMessageId,
  isStreaming,
  messageId,
}: {
  armedMessageId: Nullable<string>
  isStreaming: boolean
  messageId: string
}): boolean {
  return isStreaming && armedMessageId === messageId
}

export function shouldRenderProcessedActivityDisclosure({
  hasFinalSummaryText,
  hasGroupedRunActivity,
  hasMessageActivity = false,
  shouldUseProcessedActivityBoundary,
}: {
  hasFinalSummaryText: boolean
  hasGroupedRunActivity: boolean
  hasMessageActivity?: boolean
  shouldUseProcessedActivityBoundary: boolean
}): boolean {
  return (
    hasFinalSummaryText ||
    ((hasGroupedRunActivity || hasMessageActivity) && shouldUseProcessedActivityBoundary)
  )
}

function collectToolCallBlocksFromMessageRenderSegment(
  segment: MessageRenderSegment,
  blocks: ToolCallBlockType[]
): void {
  if (segment.kind === 'activity-group') {
    blocks.push(...segment.blocks.filter((block) => block.type === 'tool-call'))
    return
  }

  if (segment.segment.block.type === 'tool-call') blocks.push(segment.segment.block)
}

/** 这一段里的每一步：工具调用与脚本卡，按出现顺序。 */
function collectStepBlocksFromMessageRenderSegment(
  segment: MessageRenderSegment,
  blocks: ConversationStepBlock[]
): void {
  if (segment.kind === 'activity-group') {
    blocks.push(...segment.blocks)
    return
  }

  const { block } = segment.segment
  if (block.type === 'tool-call' || block.type === 'script-execution') blocks.push(block)
}

/** 消息里已有的正文与思考字数（淡入判断「刚诞生的回答」用，只在挂载时算一次）。 */
function measureStreamedTextLength(segments: readonly MessageRenderSegment[]): number {
  let length = 0
  const add = ({ block }: ToolRenderSegment): void => {
    if (block.type === 'text' || block.type === 'thinking') length += block.text.length
  }
  for (const segment of segments) {
    if (segment.kind === 'activity-group') segment.segments.forEach(add)
    else add(segment.segment)
  }
  return length
}

function AssistantMessageSegmentsInner({
  messageRenderSegments,
  isStreaming,
  implicitlyCompletedRun = false,
  messageId,
  lastTextSegmentKey,
  streamingTextSegmentKey,
  sessionId,
  runMarker = null,
  getBlockIndex,
  formatPathForDisplay,
  onOpenBrowserLink,
  onOpenProjectPath,
  onTranslateThinkingBlock,
  activityLeadingElement = null,
  activityTrailingElement = null,
  hasGroupedRunActivity = false,
  goalCompletionSummary = null,
  questionMessage = null,
  renderAfterStep,
}: {
  messageRenderSegments: MessageRenderSegment[]
  isStreaming: boolean
  implicitlyCompletedRun?: boolean
  messageId: string
  lastTextSegmentKey?: string
  streamingTextSegmentKey?: LooseOptional<string>
  sessionId: string
  runMarker?: LooseOptional<ConversationMessageRunMarker>
  questionMessage?: LooseOptional<ChatMessage>
  getBlockIndex?: (block: ContentBlock) => number | undefined
  formatPathForDisplay?: (path: string) => string
  onOpenBrowserLink?: (url: string) => void | Promise<void>
  onOpenProjectPath?: (path: string) => unknown
  onTranslateThinkingBlock?: (request: {
    messageId: string
    blockIndex: number
    text: string
  }) => Promise<void>
  activityLeadingElement?: LooseOptional<ReactElement>
  activityTrailingElement?: LooseOptional<ReactElement>
  hasGroupedRunActivity?: boolean
  goalCompletionSummary?: LooseOptional<GoalCompletionActivitySummary>
  /** 每一步（工具调用、脚本卡）后面接着画的东西，比如它派出的子 Agent 面板。 */
  renderAfterStep?: (block: ConversationStepBlock) => Nullable<ReactNode>
}): ReactElement {
  const { locale } = useConversationI18n()
  const translatorRuntime = useConversationTranslatorRuntime()
  const recentlyStreamingMessageIdRef = useRef<Nullable<string>>(null)
  // 完成请求锁存到这条消息重新开流或身份变化；动画帧可能因后台窗口而延迟，不能按墙钟撤回。
  // 折叠组件只在请求变化时安排一次动作，完成后的更新和读者手动展开不会再次触发收起。
  const [autoCollapseTracking, setAutoCollapseTracking] = useState({
    messageId,
    isStreaming,
  })
  const [autoCollapseRequested, setAutoCollapseRequested] = useState(false)
  if (
    autoCollapseTracking.messageId !== messageId ||
    autoCollapseTracking.isStreaming !== isStreaming
  ) {
    setAutoCollapseTracking({ messageId, isStreaming })
    setAutoCollapseRequested(
      shouldRequestProcessedActivityAutoCollapse(autoCollapseTracking, {
        messageId,
        isStreaming,
      })
    )
  }
  const [toolMotionArmedMessageId, setToolMotionArmedMessageId] = useState<Nullable<string>>(null)
  const animateLiveToolActivity = shouldAnimateLiveToolActivity({
    armedMessageId: toolMotionArmedMessageId,
    isStreaming,
    messageId,
  })
  const shouldRevealStreamingText =
    isStreaming || recentlyStreamingMessageIdRef.current === messageId
  const fadeView = useStreamFadeViewState({
    streaming: isStreaming,
    readTextLength: () => measureStreamedTextLength(messageRenderSegments),
  })

  useEffect(() => {
    if (isStreaming) {
      recentlyStreamingMessageIdRef.current = messageId
      return
    }

    if (recentlyStreamingMessageIdRef.current === messageId) {
      recentlyStreamingMessageIdRef.current = null
    }
  }, [isStreaming, messageId])

  // 首次挂载（含切回仍在运行的会话）先让现有工具卡提交并登记 revision，再武装后续入场动画。
  // layout effect 的同步二次渲染发生在浏览器绘制前，因此旧卡不会在重挂载时集体重播；
  // 此后真正新到达的 toolCallId 仍会正常播放一次入场。
  useLayoutEffect(() => {
    setToolMotionArmedMessageId(isStreaming ? messageId : null)
  }, [isStreaming, messageId])

  // 串行传播由状态层保证：ChatStreamPacer 把思考/正文/工具归并成单 FIFO 按到达顺序逐帧吐进
  // session，思考中途的工具调用会截断思考块、后续思考在工具卡下方新开一块（见
  // chatStreamTextState 的相邻合并判定）。组件直接渲染状态文本，不再有落后于状态的影子揭示，
  // 因此无需任何"隐藏下方内容"的门控。
  const visibleMessageRenderSegments = messageRenderSegments

  const responseDurationMs = useMemo(
    () =>
      getAssistantResponseDurationMs({
        questionMessage,
        runMarker,
        isStreaming,
      }),
    [isStreaming, questionMessage, runMarker]
  )
  const shouldUseProcessedActivityBoundary = useMemo(
    () =>
      implicitlyCompletedRun ||
      shouldUseProcessedActivitySummaryBoundary({
        isStreaming,
        runMarker,
      }),
    [implicitlyCompletedRun, isStreaming, runMarker]
  )
  const processedActivitySummaryBoundaryIndex = useMemo(
    () =>
      shouldUseProcessedActivityBoundary
        ? getProcessedActivitySummaryBoundaryIndex(visibleMessageRenderSegments)
        : -1,
    [shouldUseProcessedActivityBoundary, visibleMessageRenderSegments]
  )
  const hasFinalSummaryText =
    shouldUseProcessedActivityBoundary && processedActivitySummaryBoundaryIndex >= 0
  const shouldRenderProcessedActivity = shouldRenderProcessedActivityDisclosure({
    hasFinalSummaryText,
    hasGroupedRunActivity,
    hasMessageActivity: visibleMessageRenderSegments.some(
      (segment) =>
        segment.kind === 'activity-group' ||
        messageSegmentStartsThinking(segment) ||
        (segment.kind === 'segment' &&
          (segment.segment.block.type === 'script-execution' ||
            segment.segment.block.type === 'interaction'))
    ),
    shouldUseProcessedActivityBoundary,
  })
  const processedActivityBoundaryIndex = hasFinalSummaryText
    ? processedActivitySummaryBoundaryIndex
    : visibleMessageRenderSegments.length
  const shouldAutoCollapseProcessedActivity = !isStreaming && autoCollapseRequested
  // 流式结束那一刻读者不在底部：完成态会把这条消息整段重排进「已处理」并重挂子节点，重挂出来的
  // 折叠项、思考块一律按展开挂载，不做自动收起，读者正在看的内容就不会被抽走。跟随时照旧收起。
  const holdExpandedForReader = useConversationAutoCollapseHold(!isStreaming)
  const segmentSuffixStates = useMemo(
    () => buildMessageSegmentSuffixStates(visibleMessageRenderSegments),
    [visibleMessageRenderSegments]
  )
  const renderAfterStepElements = (
    segment: MessageRenderSegment,
    keyPrefix: string
  ): ReactNode[] => {
    if (!renderAfterStep) return []

    const stepBlocks: ConversationStepBlock[] = []
    collectStepBlocksFromMessageRenderSegment(segment, stepBlocks)

    return stepBlocks.flatMap((block) => {
      const element = renderAfterStep(block)
      const id = block.type === 'tool-call' ? block.toolCallId : block.id

      return isPresent(element)
        ? [<React.Fragment key={`${keyPrefix}:after-step:${id}`}>{element}</React.Fragment>]
        : []
    })
  }

  const renderToolRenderSegment = (segment: ToolRenderSegment): ReactElement => (
    <MessageContentBlock
      key={segment.key}
      block={segment.block}
      blockAnimationKey={segment.key}
      animateLiveToolActivity={animateLiveToolActivity}
      isStreaming={isStreaming && (segment.block.type !== 'thinking' || segment.key === visibleMessageRenderSegments.at(-1)?.key)}
      thinkingDefaultExpanded={holdExpandedForReader}
      animateStreamingText={shouldRevealStreamingText && segment.key === streamingTextSegmentKey}
      sessionId={sessionId}
      messageId={messageId}
      runMarker={!isStreaming && runMarker && segment.key === lastTextSegmentKey ? runMarker : null}
      blockIndex={getBlockIndex?.(segment.block)}
      formatPathForDisplay={formatPathForDisplay}
      onOpenBrowserLink={onOpenBrowserLink}
      onOpenProjectPath={onOpenProjectPath}
      onTranslateThinkingBlock={onTranslateThinkingBlock}
    />
  )

  const shouldRenderInlineActivitySegment = (
    segment: MessageRenderSegment,
    index: number
  ): boolean => {
    const suffixState = segmentSuffixStates[index] ?? EmptyMessageSegmentSuffixState

    if (isStreaming && messageSegmentStartsThinking(segment)) return false

    if (segment.kind === 'activity-group') return false

    return (
      messageSegmentStartsThinking(segment) &&
      (!isStreaming || suffixState.hasStartedTextAfter || suffixState.hasStartedToolActivityAfter)
    )
  }

  const renderMessageRenderSegment = (segment: MessageRenderSegment): Nullable<ReactElement> => {
    if (segment.kind !== 'activity-group') return renderToolRenderSegment(segment.segment)

    const renderActivityGroupChildren = (): ReactNode[] =>
      segment.segments.map((childSegment) => renderToolRenderSegment(childSegment))

    return (
      <ToolActivityDisclosure
        key={segment.key}
        blocks={segment.blocks}
        formatPathForDisplay={formatPathForDisplay}
      >
        {() => renderActivityGroupChildren()}
      </ToolActivityDisclosure>
    )
  }

  const renderAssistantSegments = (): ReactNode[] => {
    const renderedSegments: ReactNode[] = []
    let inlineActivityRenderers: ActivitySegmentRenderer[] = []
    let inlineActivityBlocks: ToolCallBlockType[] = []
    let inlineActivityAfterToolCallElements: ReactNode[] = []
    let inlineActivityKey: Nullable<string> = null

    const pushAfterToolCallElements = (segment: MessageRenderSegment): void => {
      renderedSegments.push(...renderAfterStepElements(segment, `message-segment:${segment.key}`))
    }

    if (!shouldRenderProcessedActivity && activityLeadingElement) {
      renderedSegments.push(
        <React.Fragment key="activity-leading">{activityLeadingElement}</React.Fragment>
      )
    }

    const flushInlineActivitySegments = (): void => {
      const renderers = [...inlineActivityRenderers]
      const blocks = [...inlineActivityBlocks]
      const afterToolCallElements = [...inlineActivityAfterToolCallElements]
      const key = inlineActivityKey

      if (isEmpty(renderers) && isEmpty(afterToolCallElements)) return

      inlineActivityRenderers = []
      inlineActivityBlocks = []
      inlineActivityAfterToolCallElements = []
      inlineActivityKey = null

      const renderSegments = (): ReactNode[] =>
        renderers.map((renderSegment) => renderSegment()).filter(isPresent)

      if (shouldRenderProcessedActivity) {
        renderedSegments.push(
          <ToolActivityDisclosure
            key={`processed-activity:${key ?? renderedSegments.length}`}
            blocks={blocks}
            autoCollapseAfterPaint={shouldAutoCollapseProcessedActivity}
            defaultExpanded={holdExpandedForReader}
            label={getProcessedActivityDisclosureLabel(
              blocks,
              locale,
              {
                goalCompletionSummary,
                responseDurationMs,
              },
              translatorRuntime
            )}
            isRunning={false}
          >
            {() => renderSegments()}
          </ToolActivityDisclosure>
        )
        renderedSegments.push(...afterToolCallElements)
        return
      }

      const segments = renderSegments()
      if (isEmpty(segments)) {
        renderedSegments.push(...afterToolCallElements)
        return
      }

      if (segments.length === 1) {
        renderedSegments.push(segments[0])
        renderedSegments.push(...afterToolCallElements)
        return
      }

      renderedSegments.push(
        <div
          key={`activity-row:${key ?? renderedSegments.length}`}
          className={styles.toolActivitySummaryRow}
        >
          {segments}
        </div>
      )
      renderedSegments.push(...afterToolCallElements)
    }

    if (shouldRenderProcessedActivity) {
      const { processedSegments, outsideSegments, trailingSegments } =
        partitionProcessedActivitySummarySegments(
          visibleMessageRenderSegments,
          processedActivityBoundaryIndex
        )
      const outsideSegmentKeys = new Set(outsideSegments.map((segment) => segment.key))
      const processedSegmentKeys = new Set(processedSegments.map((segment) => segment.key))
      const processedActivityEntries: Array<{
        segment: MessageRenderSegment
        render: ActivitySegmentRenderer
        afterStepElements: ReactNode[]
      }> = []
      const processedActivityBlocks: ToolCallBlockType[] = []
      const postDisclosureElements: ReactNode[] = []

      visibleMessageRenderSegments.forEach((segment) => {
        if (!processedSegmentKeys.has(segment.key) && !outsideSegmentKeys.has(segment.key)) return

        const afterStepElements = renderAfterStepElements(
          segment,
          `processed-segment:${segment.key}`
        )
        if (processedSegmentKeys.has(segment.key)) {
          processedActivityEntries.push({
            segment,
            render: () => renderMessageRenderSegment(segment),
            afterStepElements,
          })
          collectToolCallBlocksFromMessageRenderSegment(segment, processedActivityBlocks)
        } else if (outsideSegmentKeys.has(segment.key)) {
          const renderedSegment = renderMessageRenderSegment(segment)
          if (renderedSegment) postDisclosureElements.push(renderedSegment)
          if (!isEmpty(afterStepElements)) {
            processedActivityEntries.push({
              segment,
              render: () => null,
              afterStepElements,
            })
          }
        }
      })

      const renderProcessedActivityEntries = (): ReactNode[] => {
        const elements: ReactNode[] = []
        let inlineElements: ReactElement[] = []
        let inlineKey: Nullable<string> = null

        const flushInlineElements = (): void => {
          if (isEmpty(inlineElements)) return

          if (inlineElements.length === 1) {
            elements.push(inlineElements[0])
          } else {
            elements.push(
              <div
                key={`processed-activity-row:${inlineKey ?? elements.length}`}
                className={styles.toolActivitySummaryRow}
              >
                {inlineElements}
              </div>
            )
          }

          inlineElements = []
          inlineKey = null
        }

        processedActivityEntries.forEach(({ segment, render, afterStepElements }) => {
          const element = render()
          if (!element && isEmpty(afterStepElements)) return

          if (
            element &&
            shouldGroupProcessedActivityDisclosure(segment) &&
            isEmpty(afterStepElements)
          ) {
            inlineKey ??= segment.key
            inlineElements.push(element)
            return
          }

          flushInlineElements()
          if (element) elements.push(element)
          elements.push(...afterStepElements)
        })

        flushInlineElements()
        return elements
      }

      const includeLeadingElement = !!activityLeadingElement
      if (!isEmpty(processedActivityEntries) || includeLeadingElement) {
        const firstProcessedKey = processedSegments[0]?.key ?? 'leading'
        renderedSegments.push(
          <ToolActivityDisclosure
            key={`processed-activity:${firstProcessedKey}`}
            blocks={processedActivityBlocks}
            autoCollapseAfterPaint={shouldAutoCollapseProcessedActivity}
            defaultExpanded={holdExpandedForReader}
            label={getProcessedActivityDisclosureLabel(
              processedActivityBlocks,
              locale,
              {
                goalCompletionSummary,
                responseDurationMs,
              },
              translatorRuntime
            )}
            isRunning={false}
          >
            {() => [
              ...(activityLeadingElement
                ? [<React.Fragment key="activity-leading">{activityLeadingElement}</React.Fragment>]
                : []),
              ...renderProcessedActivityEntries(),
            ]}
          </ToolActivityDisclosure>
        )
      }

      // 成品卡排在唯一分组下方；步骤附属的子 Agent 面板跟随步骤收在组内。
      renderedSegments.push(...postDisclosureElements)
      trailingSegments.forEach((segment) => {
        const renderedSegment = renderMessageRenderSegment(segment)
        if (renderedSegment) renderedSegments.push(renderedSegment)
        pushAfterToolCallElements(segment)
      })
      if (activityTrailingElement) {
        renderedSegments.push(
          <React.Fragment key="activity-trailing">{activityTrailingElement}</React.Fragment>
        )
      }
      return renderedSegments
    }

    visibleMessageRenderSegments.forEach((segment, index) => {
      if (shouldRenderInlineActivitySegment(segment, index)) {
        inlineActivityKey ??= segment.key
        inlineActivityRenderers.push(() => renderMessageRenderSegment(segment))
        collectToolCallBlocksFromMessageRenderSegment(segment, inlineActivityBlocks)
        inlineActivityAfterToolCallElements.push(
          ...renderAfterStepElements(segment, `inline-segment:${segment.key}`)
        )
        return
      }

      const renderedSegment = renderMessageRenderSegment(segment)
      if (!renderedSegment) return

      flushInlineActivitySegments()
      renderedSegments.push(renderedSegment)
      pushAfterToolCallElements(segment)
    })

    flushInlineActivitySegments()
    if (activityTrailingElement) {
      renderedSegments.push(
        <React.Fragment key="activity-trailing">{activityTrailingElement}</React.Fragment>
      )
    }
    // 运行角标平时挂在最后一段正文末尾；整条消息没有正文（只跑了脚本就被停下、失败）时单独画一行，停没停看得出来
    const standaloneMarker =
      !isStreaming && !lastTextSegmentKey ? settledRunMarker(runMarker) : null
    if (standaloneMarker)
      renderedSegments.push(
        <div key="run-status" className={styles.standaloneStatusMarker}>
          <MessageStatusMarker marker={standaloneMarker} />
        </div>
      )
    return renderedSegments
  }

  return (
    <StreamFadeViewContext.Provider value={fadeView}>
      <div className={styles.assistantSegments}>{renderAssistantSegments()}</div>
    </StreamFadeViewContext.Provider>
  )
}

export const AssistantMessageSegments = memo(AssistantMessageSegmentsInner)

AssistantMessageSegments.displayName = 'AssistantMessageSegments'
