/**
 * 旧会话里的工具调用卡。
 *
 * 不再换专属卡片：一律是「工具图标 + 工具名 + 耗时」一行，状态看底色，点开看参数、进度、结果与错误。
 * 与脚本执行卡共用一副外框，旧会话与新会话里的每一步长同一个样子。
 */
import { memo, type ReactElement, useMemo } from 'react'

import {
  type ConversationMessageKey,
  useConversationI18n,
  useConversationTranslatorRuntime,
} from '../i18n'
import { getToolStatusLabel } from '../tool-render/toolCallSummary'
import { toolLeadingPhosphorIconForTool } from '../tool-render/toolLeadingPhosphorIcon'

import { ExecutionStepFrame, ExecutionStepPayload } from './ExecutionStepFrame'
import {
  type ExecutionStepTone,
  formatToolCallPayload,
  readToolCallErrorText,
  resolveToolCallFailureReason,
  resolveToolCallStepTone,
} from './executionStepPresentation'

import styles from './ExecutionStep.module.css'

import type { ToolCallBlock } from '#contracts'
import { trimmedStringOrEmpty } from '#internal/runtime'

const StatusMessageKeysByTone = {
  running: 'executionStep.statusRunning',
  success: 'executionStep.statusSucceeded',
  error: 'executionStep.statusFailed',
  cancelled: 'executionStep.statusCancelled',
} as const satisfies Record<ExecutionStepTone, ConversationMessageKey>

export interface ToolCallStepCardProps {
  block: ToolCallBlock
}

function ToolCallStepCardInner({ block }: ToolCallStepCardProps): ReactElement {
  const { t, locale } = useConversationI18n()
  const translatorRuntime = useConversationTranslatorRuntime()
  const tone = resolveToolCallStepTone(block)
  const title = trimmedStringOrEmpty(block.title) || block.toolName
  const hasOwnTitle = title !== block.toolName

  return (
    <ExecutionStepFrame
      slot="tool-call-step"
      tone={tone}
      statusLabel={t(StatusMessageKeysByTone[tone])}
      icon={toolLeadingPhosphorIconForTool(block.toolName, 13)}
      title={title}
      monospaceTitle={!hasOwnTitle}
      reason={resolveToolCallFailureReason(block)}
      tags={
        hasOwnTitle && (
          <span className={styles.tags}>
            <span className={styles.tag}>{block.toolName}</span>
          </span>
        )
      }
      meta={getToolStatusLabel(block, locale, translatorRuntime)}
      renderDetails={() => <ToolCallStepDetails block={block} />}
    />
  )
}

/** 展开后的详情：参数、进度、结果、错误，有什么列什么。 */
function ToolCallStepDetails({ block }: { block: ToolCallBlock }): ReactElement {
  const { t } = useConversationI18n()
  const args = useMemo(() => formatToolCallPayload(block.args), [block.args])
  const result = useMemo(
    () => (block.isRunning ? null : formatToolCallPayload(block.result ?? block.serializedResult)),
    [block.isRunning, block.result, block.serializedResult]
  )
  const progress = trimmedStringOrEmpty(block.progress)
  const errorText = block.isRunning ? null : readToolCallErrorText(block)

  if (!args && !progress && !result && !errorText)
    return <p className={styles.note}>{t('executionStep.noDetails')}</p>

  return (
    <div className={styles.section}>
      {args && (
        <ExecutionStepPayload label={t('debug.toolArgs')} text={args.text} truncated={args.truncated} />
      )}
      {!!progress && <ExecutionStepPayload label={t('debug.toolProgress')} text={progress} />}
      {result && (
        <ExecutionStepPayload
          label={t('debug.toolResult')}
          text={result.text}
          truncated={result.truncated}
        />
      )}
      {!!errorText && (
        <ExecutionStepPayload label={t('debug.toolError')} text={errorText} tone="error" />
      )}
    </div>
  )
}

export const ToolCallStepCard = memo(ToolCallStepCardInner)

ToolCallStepCard.displayName = 'ToolCallStepCard'
