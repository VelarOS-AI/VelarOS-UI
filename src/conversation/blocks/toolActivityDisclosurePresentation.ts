// 连续工具和脚本的轻量摘要；运行状态与卡片共用判定，失败和取消不算作完成。
import {
  type ExecutionStepTone,
  resolveScriptExecutionTitle,
  resolveScriptExecutionTone,
  resolveToolCallStepTone,
} from '../cards/executionStepPresentation'
import type { ConversationTranslator } from '../i18n'
import { getToolActivityGroupSummary } from '../tool-render/toolActivitySummary'
import { getToolActivitySummary } from '../tool-render/toolCallSummary'

import type { AppLocale, ConversationStepBlock } from '#contracts'
import { isEmpty } from '#internal/runtime'

export function getToolActivityDisclosureSummary(
  blocks: readonly ConversationStepBlock[],
  locale: AppLocale,
  translator: ConversationTranslator,
  formatPathForDisplay?: (path: string) => string
): { label: string; isRunning: boolean } {
  const t = translator.translate.bind(null, locale)
  const tone = (block: ConversationStepBlock): ExecutionStepTone =>
    block.type === 'script-execution'
      ? resolveScriptExecutionTone(block.status)
      : resolveToolCallStepTone(block)
  const active =
    blocks.findLast((block) =>
      block.type === 'tool-call' ? block.isRunning : block.status === 'running'
    ) ??
    blocks.findLast((block) => block.type === 'script-execution' && block.status === 'writing') ??
    blocks.findLast((block) => block.type === 'script-execution' && block.status === 'queued')
  const failedCount = blocks.filter((block) => tone(block) === 'error').length
  const cancelledCount = blocks.filter((block) => tone(block) === 'cancelled').length
  const parts: string[] = []

  if (active) {
    const status =
      active.type === 'script-execution' && active.status === 'writing'
        ? t('executionStep.statusWriting')
        : active.type === 'script-execution' && active.status === 'queued'
          ? t('executionStep.statusQueued')
          : t('executionStep.statusRunning')
    const title =
      active.type === 'script-execution'
        ? (resolveScriptExecutionTitle(active, {
            wait: t('scriptExecution.waitTitle'),
            stop: t('scriptExecution.stopTitle'),
          }) ?? t('scriptExecution.executeTitle'))
        : active.title?.trim() ||
          getToolActivitySummary(active, locale, formatPathForDisplay, translator)
    parts.push(`${status} · ${title}`)
    if (blocks.length > 1) parts.push(t('toolSummary.activityStepCount', { count: blocks.length }))
  } else {
    const completedTools = blocks
      .filter((block) => block.type === 'tool-call')
      .filter((block) => tone(block) === 'success')
    const completedScripts = blocks.filter(
      (block) => block.type === 'script-execution' && tone(block) === 'success'
    )
    if (!isEmpty(completedTools))
      parts.push(
        getToolActivityGroupSummary(completedTools, locale, translator) ||
          t('toolSummary.activityCompletedSteps', { count: completedTools.length })
      )
    if (!isEmpty(completedScripts))
      parts.push(t('toolSummary.activityCompletedSteps', { count: completedScripts.length }))
  }
  if (cancelledCount)
    parts.unshift(t('toolSummary.activityCancelledSteps', { count: cancelledCount }))
  if (failedCount) parts.unshift(t('toolSummary.activityFailedSteps', { count: failedCount }))

  return { label: parts.filter(Boolean).join(' · ') || t('chat.toolCalls'), isRunning: !!active }
}
