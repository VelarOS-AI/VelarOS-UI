import { type ReactElement, type ReactNode, useCallback, useMemo } from 'react'

import { StyleUtils } from '@velaros-ai/ui'

import type { FileChangeSummaryListEntry } from '../cards/FileChangeSummaryList'
import { useConversationI18n } from '../i18n'
import {
  type BrowserScreenshotDisplayMode,
  useConversationRenderSlots,
} from '../render-slots'
import {
  type ChatInlineNoticeMeta,
  type ChatInlineNoticeRuntimeSource,
} from '../status/chatStatus'
import { getLatestPlanToolCallId } from '../tool-render/plan/planToolBlock'
import {
  buildToolRenderSegments,
  isToolActivitySummaryExcludedToolCall,
  type ToolActivitySummaryExclusionPredicate,
} from '../tool-render/toolCallRenderGrouping'

import { AssistantMessageFooter } from './AssistantMessageFooter'
import { AssistantMessageSegments } from './AssistantMessageSegments'
import {
  AssistantProviderArtifactGroup,
  hasVisibleAssistantProviderArtifacts,
} from './AssistantProviderArtifactGroup'
import { hasVisibleBrowserScreenshots } from './browserScreenshotPresence'
import { useChatThinkingVisibility } from './chatThinkingVisibility'
import { useConversationBlockHooks } from './conversationBlockHooks'
import { InlineRuntimeNotice } from './InlineRuntimeNotice'
import { MessageActionList } from './MessageActionList'
import {
  buildMessageRenderSegments,
  type ConversationMessageRunMarker,
  getLastTextSegmentKey,
  getStreamingTextSegmentKey,
  getVisibleMessageBlocks,
  type GoalCompletionActivitySummary,
  hasVisibleSegmentContent,
  shouldShowAssistantGeneratedArtifacts,
} from './messageBubbleRenderModel'
import type { RunCostEstimate } from './messageCostEstimate'
import {
  hasVisibleToolModelImages,
  ToolModelImageGroup,
} from './ToolModelImageGroup'

import styles from './MessageBubble.module.css'

import type {
  ChatMessage,
  ContentBlock,
  ConversationStepBlock,
  ProjectRootEntry,
} from '#contracts'
import { isEmpty, toNullable } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)
const EmptyProjectRoots: ProjectRootEntry[] = []

function createPlanAwareToolActivityExclusionPredicate(
  latestMessagePlanToolCallId: Nullable<string>
): ToolActivitySummaryExclusionPredicate {
  return (block) => {
    const isExcluded = isToolActivitySummaryExcludedToolCall(block)

    if (block.toolName === 'plan:update')
      return latestMessagePlanToolCallId
        ? block.toolCallId === latestMessagePlanToolCallId
        : isExcluded

    return isExcluded
  }
}

export function AssistantMessageBubble({
  browserScreenshotDisplayMode = 'original',
  message,
  sessionId,
  questionMessage = null,
  isStreaming = false,
  runInProgress = false,
  runMarker = null,
  implicitlyCompletedRun = false,
  inlineNotice = null,
  inlineNoticeRuntimeSource = null,
  showToolDetails = true,
  activeProjectRoot = null,
  projectRoots = EmptyProjectRoots,
  canShowFileChangeSummary = true,
  runCostEstimate = null,
  goalCompletionSummary = null,
  activityLeadingElement = null,
  activityTrailingElement = null,
  renderAfterStep,
  onOpenBrowserLink,
  onOpenFileChange,
  onOpenProjectPath,
  onReviewFileChanges,
  onTranslateThinkingBlock,
}: {
  browserScreenshotDisplayMode?: BrowserScreenshotDisplayMode
  message: ChatMessage
  sessionId: string
  questionMessage?: LooseOptional<ChatMessage>
  isStreaming?: boolean
  /** 这条消息所属的执行还没停：收尾件（复制与时间等）先不出现。 */
  runInProgress?: boolean
  runMarker?: LooseOptional<ConversationMessageRunMarker>
  implicitlyCompletedRun?: boolean
  inlineNotice?: LooseOptional<ChatInlineNoticeMeta>
  inlineNoticeRuntimeSource?: LooseOptional<ChatInlineNoticeRuntimeSource>
  showToolDetails?: boolean
  activeProjectRoot?: LooseOptional<string>
  projectRoots?: ProjectRootEntry[]
  canShowFileChangeSummary?: boolean
  /** 这次执行的约价；只由会话壳按执行用量账算好传入，气泡不再拿可见问答文字自己估。 */
  runCostEstimate?: LooseOptional<RunCostEstimate>
  goalCompletionSummary?: LooseOptional<GoalCompletionActivitySummary>
  activityLeadingElement?: LooseOptional<ReactElement>
  activityTrailingElement?: LooseOptional<ReactElement>
  /** 每一步（工具调用、脚本卡）后面接着画的东西，比如它派出的子 Agent 面板。 */
  renderAfterStep?: (block: ConversationStepBlock) => Nullable<ReactNode>
  onOpenBrowserLink?: (url: string) => void | Promise<void>
  onOpenFileChange?: (entry: FileChangeSummaryListEntry) => void | Promise<void>
  onOpenProjectPath?: (path: string) => unknown
  onReviewFileChanges?: (entries: FileChangeSummaryListEntry[]) => void | Promise<void>
  onTranslateThinkingBlock?: (request: {
    messageId: string
    blockIndex: number
    text: string
  }) => Promise<void>
}): Nullable<ReactElement> {
  const { t, locale } = useConversationI18n()
  const showThinkingProcess = useChatThinkingVisibility()
  const { useMessageActionView } = useConversationBlockHooks()
  const blockIndexByRef = useMemo(() => {
    const nextBlockIndexByRef = new Map<ContentBlock, number>()

    for (let index = 0; index < message.blocks.length; index += 1) {
      const block = message.blocks[index]
      if (block) nextBlockIndexByRef.set(block, index)
    }

    return nextBlockIndexByRef
  }, [message.blocks])
  const getBlockIndex = useCallback(
    (block: ContentBlock) => blockIndexByRef.get(block),
    [blockIndexByRef]
  )
  const {
    actionRows,
    formatPathForDisplay: formatMessagePathForDisplay,
    hasActionItems,
    openPathInLight,
  } = useMessageActionView({
    activeProjectRoot,
    message,
    onOpenProjectPath,
    sessionId,
    projectRoots,
  })
  const {
    messageRenderSegments,
    visibleBlocks,
    hasVisibleToolBlocks,
    hasRenderableContent,
    lastTextSegmentKey,
    streamingTextSegmentKey,
  } = useMemo(() => {
    const visibleBlocks = getVisibleMessageBlocks(message, showToolDetails, {
      showThinkingProcess,
    })
    const isPlanAwareToolActivityExcluded = createPlanAwareToolActivityExclusionPredicate(
      getLatestPlanToolCallId(message.blocks)
    )
    const nextRenderableSegments = buildToolRenderSegments(visibleBlocks)

    return {
      messageRenderSegments: buildMessageRenderSegments(nextRenderableSegments, {
        isToolActivitySummaryExcludedToolCall: isPlanAwareToolActivityExcluded,
      }),
      visibleBlocks,
      hasVisibleToolBlocks: visibleBlocks.some(
        (block) => block.type === 'tool-call' || block.type === 'script-execution'
      ),
      hasRenderableContent: nextRenderableSegments.some(hasVisibleSegmentContent),
      lastTextSegmentKey: getLastTextSegmentKey(nextRenderableSegments),
      streamingTextSegmentKey: getStreamingTextSegmentKey(nextRenderableSegments),
    }
  }, [
    message,
    showThinkingProcess,
    showToolDetails,
  ])
  const hasBrowserScreenshotGroup = useMemo(
    () => hasVisibleBrowserScreenshots(visibleBlocks),
    [visibleBlocks]
  )
  const hasToolModelImageGroup = useMemo(
    () => hasVisibleToolModelImages(visibleBlocks),
    [visibleBlocks]
  )
  const hasProviderArtifactGroup = useMemo(
    () => hasVisibleAssistantProviderArtifacts(visibleBlocks),
    [visibleBlocks]
  )
  const slots = useConversationRenderSlots()
  const messageArtifactActivityTrailingElement = useMemo(() => {
    const elements: ReactElement[] = []

    if (hasBrowserScreenshotGroup) {
      const browserScreenshotElement = slots.browserScreenshotGroup({
        blocks: visibleBlocks,
        displayMode: browserScreenshotDisplayMode,
        sessionId,
      })
      if (browserScreenshotElement) elements.push(browserScreenshotElement)
    }

    if (hasToolModelImageGroup) {
      elements.push(<ToolModelImageGroup key="tool-model-images" blocks={visibleBlocks} />)
    }

    if (hasProviderArtifactGroup) {
      elements.push(
        <AssistantProviderArtifactGroup
          key="assistant-provider-artifacts"
          blocks={visibleBlocks}
          onOpenBrowserLink={onOpenBrowserLink}
        />
      )
    }

    return isEmpty(elements) ? null : <>{elements}</>
  }, [
    browserScreenshotDisplayMode,
    hasBrowserScreenshotGroup,
    hasProviderArtifactGroup,
    hasToolModelImageGroup,
    onOpenBrowserLink,
    sessionId,
    slots,
    visibleBlocks,
  ])
  const showInlineNotice =
    !!inlineNotice && (!hasRenderableContent || inlineNotice.tone === 'running')
  const showGeneratedArtifacts = shouldShowAssistantGeneratedArtifacts({
    isStreaming,
    runInProgress,
    runMarker,
  })
  const generatedActivityTrailingElement = showGeneratedArtifacts
    ? messageArtifactActivityTrailingElement
    : null
  const combinedActivityTrailingElement =
    activityTrailingElement || generatedActivityTrailingElement ? (
      <>
        {activityTrailingElement}
        {generatedActivityTrailingElement}
      </>
    ) : null
  const hasGroupedRunActivity = !!activityLeadingElement || !!activityTrailingElement
  const hasVisibleActionItems = hasActionItems && showGeneratedArtifacts

  if (
    !hasRenderableContent &&
    !hasVisibleActionItems &&
    !showInlineNotice &&
    !activityLeadingElement &&
    !combinedActivityTrailingElement
  )
    return null

  return (
    <div
      className={cx('root', 'assistant', hasVisibleToolBlocks && 'assistantWithTools')}
      data-message-id={message.id}
      data-message-role={message.role}
    >
      <div className={cx('assistantRow', hasVisibleToolBlocks && 'assistantRowWithTools')}>
        <div className={cx('assistantBubble', hasVisibleToolBlocks && 'assistantBubbleWithTools')}>
          <AssistantMessageSegments
            messageRenderSegments={messageRenderSegments}
            isStreaming={isStreaming}
            implicitlyCompletedRun={implicitlyCompletedRun}
            messageId={message.id}
            lastTextSegmentKey={lastTextSegmentKey}
            streamingTextSegmentKey={streamingTextSegmentKey}
            sessionId={sessionId}
            runMarker={runMarker}
            getBlockIndex={getBlockIndex}
            formatPathForDisplay={formatMessagePathForDisplay}
            onOpenBrowserLink={onOpenBrowserLink}
            onOpenProjectPath={openPathInLight}
            onTranslateThinkingBlock={onTranslateThinkingBlock}
            goalCompletionSummary={goalCompletionSummary}
            questionMessage={questionMessage}
            activityLeadingElement={activityLeadingElement}
            activityTrailingElement={combinedActivityTrailingElement}
            hasGroupedRunActivity={hasGroupedRunActivity}
            renderAfterStep={renderAfterStep}
          />

          {canShowFileChangeSummary &&
            showGeneratedArtifacts &&
            slots.messageFileChangeSummary({
              message,
              runMarker,
              sessionId,
              formatPathForDisplay: formatMessagePathForDisplay,
              onOpenEntry: onOpenFileChange,
              onReviewEntries: onReviewFileChanges,
            })}

          {hasActionItems && showGeneratedArtifacts && (
            <MessageActionList rows={actionRows} revealLabel={t('chat.openContainingFolder')} />
          )}

          {showInlineNotice && (
            <InlineRuntimeNotice
              notice={inlineNotice}
              runtimeSource={inlineNoticeRuntimeSource}
              sessionId={sessionId}
            />
          )}
        </div>
        {showGeneratedArtifacts && (
          <AssistantMessageFooter
            message={message}
            runCostEstimate={toNullable(runCostEstimate)}
            copyLabel={t('chat.copyAnswer')}
            copiedLabel={t('chat.codeBlockCopied')}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}
