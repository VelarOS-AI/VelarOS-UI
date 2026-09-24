/**
 * 执行步骤卡的外框：一行标题（状态图标 + 一句话 + 标签 + 行尾状态）本身就是展开按钮，点开看详情；
 * 给了源码预览时悬停标题行弹出可追进去滚动、选中复制的气泡（HoverCard），Escape 关闭。
 * 脚本执行卡与旧工具调用卡共用这副外框，聊天流里的每一步都长同一个样子。
 */
import { type MouseEvent, type ReactElement, type ReactNode, useId, useState } from 'react'
import {
  CaretRightIcon,
  CheckCircleIcon,
  CodeIcon,
  type Icon,
  type IconWeight,
  MinusCircleIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'

import { StyleUtils } from '@velaros-ai/ui'
import { HoverCard } from '@velaros-ai/ui/primitives/overlays/HoverCard'

import { useConversationI18n } from '../i18n'
import { AutoScrollSuspendEventName } from '../react-hooks/scrollBehavior'
import { useDisclosurePresence } from '../react-hooks/useDisclosurePresence'

import { type ExecutionStepTone, isLongExecutionPayload } from './executionStepPresentation'

import styles from './ExecutionStep.module.css'

import { optionalWhen } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)

const StatusIconByTone = {
  running: SpinnerGapIcon,
  success: CheckCircleIcon,
  error: WarningCircleIcon,
  cancelled: MinusCircleIcon,
} as const satisfies Record<ExecutionStepTone, Icon>

const StatusIconWeightByTone = {
  running: 'bold',
  success: 'fill',
  error: 'fill',
  cancelled: 'fill',
} as const satisfies Record<ExecutionStepTone, IconWeight>

/** 进行中的图标在转，其余只换颜色；已取消沿用默认的灰。 */
const StatusIconClassByTone = {
  running: 'statusIconRunning',
  success: 'statusIconSuccess',
  error: 'statusIconError',
  cancelled: false,
} as const satisfies Record<ExecutionStepTone, string | false>

/** 标题行与详情段头两种位置的图标尺寸。 */
const StatusIconSizeByPlacement = {
  header: 13,
  section: 12,
} as const

/** 与步骤状态同色的小图标。给了 `label` 就作为带名字的图像读出来，否则只是装饰。 */
export function ExecutionStepStatusIcon({
  tone,
  placement,
  label,
}: {
  tone: ExecutionStepTone
  placement: keyof typeof StatusIconSizeByPlacement
  label?: string
}): ReactElement {
  const StatusIcon = StatusIconByTone[tone]

  return (
    <span
      className={cx(
        placement === 'header' ? 'statusIcon' : 'sectionIcon',
        StatusIconClassByTone[tone]
      )}
      role={optionalWhen(label, 'img')}
      aria-label={label}
      aria-hidden={optionalWhen(!label, true)}
    >
      <StatusIcon size={StatusIconSizeByPlacement[placement]} weight={StatusIconWeightByTone[tone]} />
    </span>
  )
}

export interface ExecutionStepFrameProps {
  /** 写在根节点 `data-slot` 上，宿主与测试据此认出是哪种步骤卡。 */
  slot: 'script-execution' | 'tool-call-step'
  tone: ExecutionStepTone
  /** 状态的读屏文字；图标本身不带字。 */
  statusLabel: string
  title: string
  /** 标题是工具名这类标识符时用等宽字。 */
  monospaceTitle?: boolean
  /** 标题下那行灰红小字：不点开也看得到为什么失败。 */
  reason?: LooseOptional<string>
  /** 标题右边的标签（用到的模块、工具名），用 `ExecutionStep.module.css` 的 `tags` / `tag` 排。 */
  tags?: ReactNode
  /** 行尾的状态文字（耗时、执行中）。 */
  meta?: ReactNode
  /** 悬停标题行时弹出的源码预览；给了才挂气泡，行尾同时出现代码图标作提示。 */
  sourcePreview?: ReactNode
  /** 展开后的详情；只在展开期间渲染，收起的卡不付这份开销。 */
  renderDetails: () => ReactNode
}

export function ExecutionStepFrame({
  slot,
  tone,
  statusLabel,
  title,
  monospaceTitle = false,
  reason,
  tags,
  meta,
  sourcePreview,
  renderDetails,
}: ExecutionStepFrameProps): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const { mounted, visible } = useDisclosurePresence(expanded)
  const detailsId = useId()

  const handleToggle = (event: MouseEvent<HTMLButtonElement>): void => {
    // 展开会撑高消息：先让会话停止跟随底部，读者正在看的这张卡不被推走。
    event.currentTarget.dispatchEvent(new Event(AutoScrollSuspendEventName, { bubbles: true }))
    setExpanded((current) => !current)
  }

  const header = (
    <button
      type="button"
      className={styles.header}
      aria-expanded={expanded}
      aria-controls={optionalWhen(mounted, detailsId)}
      onClick={handleToggle}
    >
      <ExecutionStepStatusIcon tone={tone} placement="header" label={statusLabel} />
      <span className={styles.text}>
        <span className={cx('title', monospaceTitle && 'titleMono')}>{title}</span>
        {!!reason && <span className={styles.reason}>{reason}</span>}
      </span>
      {tags}
      {!!meta && <span className={styles.meta}>{meta}</span>}
      {!!sourcePreview && (
        <span className={styles.affordance} aria-hidden="true">
          <CodeIcon size={13} />
        </span>
      )}
      <span className={cx('caret', expanded && 'caretExpanded')} aria-hidden="true">
        <CaretRightIcon size={12} weight="bold" />
      </span>
    </button>
  )

  return (
    <div className={cx('root', tone === 'error' && 'rootError')} data-slot={slot} data-tone={tone}>
      {sourcePreview ? (
        <HoverCard content={sourcePreview} widthStrategy="anchor">
          {header}
        </HoverCard>
      ) : (
        header
      )}
      {mounted && (
        <div id={detailsId} className={cx('detailsShell', visible && 'detailsShellVisible')}>
          <div className={styles.detailsFrame}>
            <div className={styles.details}>{renderDetails()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 详情里的一段参数 / 返回 / 错误：左边小标签，右边等宽正文；长的先折起来，点「展开全部」再看。 */
export function ExecutionStepPayload({
  label,
  text,
  truncated = false,
  tone = 'default',
}: {
  label: string
  text: string
  /** 宿主或渲染层按上限截过，末尾标一句。 */
  truncated?: boolean
  tone?: 'default' | 'error'
}): ReactElement {
  const { t } = useConversationI18n()
  const [expanded, setExpanded] = useState(false)
  const foldable = isLongExecutionPayload(text)

  return (
    <div className={styles.payload}>
      <span className={styles.payloadLabel}>{label}</span>
      <div className={styles.payloadBody}>
        <pre
          className={cx(
            'payloadText',
            tone === 'error' && 'payloadTextError',
            foldable && !expanded && 'payloadTextFolded'
          )}
        >
          {text}
        </pre>
        {truncated && <p className={styles.note}>{t('executionStep.payloadTruncated')}</p>}
        {foldable && (
          <button
            type="button"
            className={styles.payloadToggle}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {t(expanded ? 'executionStep.collapsePayload' : 'executionStep.expandPayload')}
          </button>
        )}
      </div>
    </div>
  )
}
