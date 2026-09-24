/**
 * 脚本执行卡：模型一轮里的一个 execute 声明。
 *
 * 标题行用一句话说这一步做什么，右边列出用到的模块；悬停标题行看这一步实际执行的脚本源码，
 * 点开看每次能力调用的参数、返回与错误。不走旧工具卡的分类，也不进「调用了 N 次工具」的折叠。
 */
import { memo, type ReactElement, useMemo } from 'react'

import { StyleUtils } from '@velaros-ai/ui'

import { type ConversationMessageKey, useConversationI18n } from '../i18n'

import { ExecutionStepFrame, ExecutionStepPayload, ExecutionStepStatusIcon } from './ExecutionStepFrame'
import {
  formatScriptModuleLabel,
  formatScriptPayload,
  resolveScriptExecutionCallTone,
  resolveScriptExecutionFailureReason,
  resolveScriptExecutionTitle,
  resolveScriptExecutionTone,
} from './executionStepPresentation'

import styles from './ExecutionStep.module.css'

import type { ScriptExecutionBlock, ScriptExecutionCall } from '#contracts'
import { isEmpty, isNonBlankString, trimmedStringOrEmpty } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)

/** 标题行最多直接露出几个模块，其余收成「+N」，全名在详情里。 */
const MaxVisibleModuleTags = 3

const ScriptStatusMessageKeys = {
  writing: 'executionStep.statusWriting',
  running: 'executionStep.statusRunning',
  succeeded: 'executionStep.statusSucceeded',
  failed: 'executionStep.statusFailed',
  cancelled: 'executionStep.statusCancelled',
} as const satisfies Record<ScriptExecutionBlock['status'], ConversationMessageKey>

const CallStatusMessageKeys = {
  pending: 'scriptExecution.callStatusPending',
  succeeded: 'scriptExecution.callStatusSucceeded',
  failed: 'scriptExecution.callStatusFailed',
  cancelled: 'scriptExecution.callStatusCancelled',
} as const satisfies Record<ScriptExecutionCall['status'], ConversationMessageKey>

const CallEffectMessageKeys = {
  none: 'scriptExecution.callEffectNone',
  committed: 'scriptExecution.callEffectCommitted',
  partial: 'scriptExecution.callEffectPartial',
  unknown: 'scriptExecution.callEffectUnknown',
} as const satisfies Record<ScriptExecutionCall['effect'], ConversationMessageKey>

export interface ScriptExecutionCardProps {
  block: ScriptExecutionBlock
}

function ScriptExecutionCardInner({ block }: ScriptExecutionCardProps): ReactElement {
  const { t } = useConversationI18n()
  const title = resolveScriptExecutionTitle(block) ?? t('scriptExecution.executeTitle')
  const visibleModules = block.modules.slice(0, MaxVisibleModuleTags)
  const hiddenModuleCount = block.modules.length - visibleModules.length

  return (
    <ExecutionStepFrame
      slot="script-execution"
      tone={resolveScriptExecutionTone(block.status)}
      statusLabel={t(ScriptStatusMessageKeys[block.status])}
      title={title}
      reason={resolveScriptExecutionFailureReason(block)}
      tags={
        !isEmpty(visibleModules) && (
          <span className={styles.tags}>
            {visibleModules.map((moduleId) => (
              <span key={moduleId} className={styles.tag}>
                {formatScriptModuleLabel(moduleId)}
              </span>
            ))}
            {hiddenModuleCount > 0 && (
              <span
                className={cx('tag', 'tagOverflow')}
                aria-label={t('scriptExecution.moreModules', { count: hiddenModuleCount })}
              >
                +{hiddenModuleCount}
              </span>
            )}
          </span>
        )
      }
      sourcePreview={<ScriptSourcePreview block={block} />}
      renderDetails={() => <ScriptExecutionDetails block={block} />}
    />
  )
}

/** 悬停气泡里的脚本源码；编写中还没有源码时给一句正在编写。 */
export function ScriptSourcePreview({
  block,
}: {
  block: Pick<ScriptExecutionBlock, 'source' | 'sourceTruncated' | 'status'>
}): ReactElement {
  const { t } = useConversationI18n()

  if (!isNonBlankString(block.source))
    return (
      <p className={styles.note}>
        {t(block.status === 'writing' ? 'scriptExecution.sourceWriting' : 'scriptExecution.sourceEmpty')}
      </p>
    )

  return (
    <div className={styles.source} data-slot="script-execution-source">
      <pre className={styles.sourceCode}>
        <code>{block.source}</code>
      </pre>
      {block.sourceTruncated && <p className={styles.note}>{t('scriptExecution.sourceTruncated')}</p>}
    </div>
  )
}

/** 展开后的详情：按发出顺序列出每次能力调用，脚本本身的错误排在最后。 */
export function ScriptExecutionDetails({ block }: { block: ScriptExecutionBlock }): ReactElement {
  const { t } = useConversationI18n()
  const error = trimmedStringOrEmpty(block.error)

  return (
    <>
      {isEmpty(block.calls) && !error && <p className={styles.note}>{t('scriptExecution.noCalls')}</p>}
      {block.calls.map((call, index) => (
        // 调用只会按发出顺序往后追加，序号就是它的身份。
        <ScriptExecutionCallSection key={index} call={call} />
      ))}
      {!!error && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <ExecutionStepStatusIcon tone="error" placement="section" />
            <span className={styles.sectionLabel}>{t('scriptExecution.scriptError')}</span>
          </div>
          <p className={styles.errorText}>{error}</p>
        </section>
      )}
    </>
  )
}

function ScriptExecutionCallSection({ call }: { call: ScriptExecutionCall }): ReactElement {
  const { t } = useConversationI18n()
  const input = useMemo(() => formatScriptPayload(call.input), [call.input])
  const output = useMemo(() => formatScriptPayload(call.output), [call.output])
  const tone = resolveScriptExecutionCallTone(call.status)
  const failed = call.status === 'failed'

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <ExecutionStepStatusIcon tone={tone} placement="section" />
        <span className={styles.sectionName}>
          {call.module} · {call.operation}
        </span>
        <span className={styles.sectionMeta}>
          {t(CallStatusMessageKeys[call.status])} · {t(CallEffectMessageKeys[call.effect])}
        </span>
      </div>
      {!!input && (
        <ExecutionStepPayload
          label={t('scriptExecution.callInput')}
          text={input}
          truncated={call.inputTruncated}
        />
      )}
      {!!output && (
        <ExecutionStepPayload
          label={t(failed ? 'scriptExecution.callError' : 'scriptExecution.callOutput')}
          text={output}
          truncated={call.outputTruncated}
          tone={failed ? 'error' : 'default'}
        />
      )}
    </section>
  )
}

export const ScriptExecutionCard = memo(ScriptExecutionCardInner)

ScriptExecutionCard.displayName = 'ScriptExecutionCard'
