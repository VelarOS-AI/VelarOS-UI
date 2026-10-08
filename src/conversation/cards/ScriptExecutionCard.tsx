/**
 * 脚本执行卡：模型一轮里的一个程序声明。execute 这一轮执行一次，observe 登记持续观察、从下一回合起每帧
 * 运行；两种只靠标题行最左的图标区分（命令图标、搜索图标）。标题用一句话说这一步做什么，右边是执行用了
 * 多久；状态只看整张卡的底色。收起时悬停标题行看源码，点开看执行的代码与每次调用的结果，都按语法着色。
 * 跑着的时候，正在跑的命令刚吐出的输出露在标题下（宿主经块钩子给），跑完就没了。
 * 不走旧工具卡的分类，也不进「调用了 N 次工具」的折叠。
 */
import { memo, type ReactElement, useEffect, useMemo, useState } from 'react'

import { useConversationBlockHooks } from '../blocks/conversationBlockHooks'
import {
  type ConversationMessageKey,
  useConversationI18n,
  useConversationTranslatorRuntime,
} from '../i18n'
import { useTimerScope } from '../react-hooks/useTimerScope'
import { formatToolDurationMs } from '../tool-render/toolCallSummary'
import { toolLeadingPhosphorIcon } from '../tool-render/toolLeadingPhosphorIcon'

import { ExecutionStepFrame, ExecutionStepPayload } from './ExecutionStepFrame'
import {
  formatScriptPayload,
  resolveScriptExecutionFailureReason,
  resolveScriptExecutionTitle,
  resolveScriptExecutionTone,
  resolveScriptPayloadLanguage,
} from './executionStepPresentation'

import styles from './ExecutionStep.module.css'

import type { ScriptExecutionBlock, ScriptExecutionCall } from '#contracts'
import { isNonBlankString, isPresent, optionalWhen, trimmedStringOrEmpty } from '#internal/runtime'

/** 标题行图标的尺寸，与原来的工具行一致。 */
const StepIconSize = 13

const ScriptStatusMessageKeys = {
  writing: 'executionStep.statusWriting',
  running: 'executionStep.statusRunning',
  succeeded: 'executionStep.statusSucceeded',
  failed: 'executionStep.statusFailed',
  cancelled: 'executionStep.statusCancelled',
} as const satisfies Record<ScriptExecutionBlock['status'], ConversationMessageKey>

export interface ScriptExecutionCardProps {
  block: ScriptExecutionBlock
}

function ScriptExecutionCardInner({ block }: ScriptExecutionCardProps): ReactElement {
  const { t, locale } = useConversationI18n()
  const translatorRuntime = useConversationTranslatorRuntime()
  const live = useConversationBlockHooks().useScriptLiveOutput(block.id)
  const observe = block.kind === 'observe'
  const title =
    resolveScriptExecutionTitle(block) ??
    t(observe ? 'scriptExecution.observeTitle' : 'scriptExecution.executeTitle')
  const duration =
    isPresent(block.durationMs) && Math.round(block.durationMs) > 0
      ? formatToolDurationMs(block.durationMs, locale, translatorRuntime)
      : null

  return (
    <ExecutionStepFrame
      slot="script-execution"
      tone={resolveScriptExecutionTone(block.status)}
      statusLabel={t(ScriptStatusMessageKeys[block.status])}
      icon={toolLeadingPhosphorIcon(observe ? 'search' : 'command', StepIconSize)}
      title={title}
      reason={resolveScriptExecutionFailureReason(block)}
      live={optionalWhen(block.status === 'running', live)}
      meta={block.status === 'running'
        ? <ScriptExecutionLiveDuration key={`${block.id}:${block.startedAt ?? ''}`} startedAt={block.startedAt} />
        : duration}
      renderDetails={() => <ScriptExecutionDetails block={block} />}
    />
  )
}

/** 只有运行中的卡订阅时钟；状态落定后卸载，右侧改读最终耗时。 */
function ScriptExecutionLiveDuration({ startedAt }: { startedAt?: number }): ReactElement {
  const { locale } = useConversationI18n()
  const translatorRuntime = useConversationTranslatorRuntime()
  const timers = useTimerScope('ScriptExecutionLiveDuration')
  const [mountedAt] = useState(Date.now)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const clock = timers.every(1000, () => setNow(Date.now()))
    return () => { clock.cancel() }
  }, [timers])
  return <span data-slot="execution-step-elapsed">{
    formatToolDurationMs(Math.max(0, now - (startedAt ?? mountedAt)), locale, translatorRuntime)
  }</span>
}

/** 展开后的详情：执行的代码，接着按发出顺序是每次调用的结果，脚本本身的错误排在最后。 */
export function ScriptExecutionDetails({ block }: { block: ScriptExecutionBlock }): ReactElement {
  const { t } = useConversationI18n()
  const error = trimmedStringOrEmpty(block.error)

  return (
    <>
      {isNonBlankString(block.source) ? (
        <ExecutionStepPayload text={block.source} language="typescript" />
      ) : (
        <p className={styles.note}>
          {t(block.status === 'writing' ? 'scriptExecution.sourceWriting' : 'scriptExecution.sourceEmpty')}
        </p>
      )}
      {block.calls.map(
        (call, index) =>
          // 调用只会按发出顺序往后追加，序号就是它的身份；还没有返回的调用先不占位置。
          isNonBlankString(call.output) && <ScriptExecutionResult key={index} call={call} />
      )}
      {!!error && <p className={styles.errorText}>{error}</p>}
    </>
  )
}

/** 一次调用的结果：JSON 按语法着色，失败的红字显示错误。 */
function ScriptExecutionResult({ call }: { call: ScriptExecutionCall }): ReactElement {
  const output = useMemo(() => formatScriptPayload(call.output), [call.output])

  return (
    <ExecutionStepPayload
      text={output}
      language={resolveScriptPayloadLanguage(output)}
      tone={call.status === 'failed' ? 'error' : 'default'}
    />
  )
}

export const ScriptExecutionCard = memo(ScriptExecutionCardInner)

ScriptExecutionCard.displayName = 'ScriptExecutionCard'
