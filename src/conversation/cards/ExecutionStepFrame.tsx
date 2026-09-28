/**
 * 执行步骤卡的外框：一行标题（图标 + 一句话 + 标签 + 行尾状态）本身就是展开按钮，点开看详情。
 * 状态不画图标，看整张卡的底色：进行中与已取消是很淡的灰，成功淡绿，失败淡红。脚本执行卡、旧工具调用卡与
 * 回答过的交互卡共用这副外框，聊天流里的每一步都长同一个样子。
 */
import {
  Fragment,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'

import { StyleUtils } from '@velaros-ai/ui'

import { useConversationI18n } from '../i18n'
import { AutoScrollSuspendEventName } from '../react-hooks/scrollBehavior'
import { useDisclosurePresence } from '../react-hooks/useDisclosurePresence'

import {
  type ExecutionStepCodeLanguage,
  type HighlightedCode,
  highlightedTokenStyle,
  useHighlightedCode,
} from './executionStepHighlight'
import { type ExecutionFrameTone, isLongExecutionPayload } from './executionStepPresentation'
import { ExpandableContentControls } from './ExpandableContentControls'

import styles from './ExecutionStep.module.css'

import { isNonBlankString, optionalWhen } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)

/** 运行中的输出在标题下最多露几行。 */
const LiveOutputLines = 3

export interface ExecutionStepFrameProps {
  /** 写在根节点 `data-slot` 上，宿主与测试据此认出是哪种步骤卡。 */
  slot: 'script-execution' | 'tool-call-step' | 'interaction'
  /** 整张卡的底色跟着它走。 */
  tone: ExecutionFrameTone
  /** 状态的读屏文字；卡片上的状态只看底色。 */
  statusLabel: string
  /** 标题行最左边的图标：执行是命令、观察是搜索，旧工具调用是工具自己的图标。 */
  icon: ReactNode
  title: string
  /** 标题是工具名这类标识符时用等宽字。 */
  monospaceTitle?: boolean
  /** 标题下那行灰红小字：不点开也看得到为什么失败。 */
  reason?: LooseOptional<string>
  /** 标题下那行中性小字：交互卡收起后写明答了什么。 */
  summary?: LooseOptional<string>
  /** 正在跑的命令刚吐出的输出：标题下最后几行等宽小字，收起也看得到，跑完就没了。 */
  live?: LooseOptional<string>
  /** 标题右边的标签（用到的模块、工具名），用 `ExecutionStep.module.css` 的 `tags` / `tag` 排。 */
  tags?: ReactNode
  /** 行尾的状态文字（耗时、执行中）。 */
  meta?: ReactNode
  /** 展开后的详情；只在展开期间渲染，收起的卡不付这份开销。 */
  renderDetails: () => ReactNode
}

export function ExecutionStepFrame({
  slot,
  tone,
  statusLabel,
  icon,
  title,
  monospaceTitle = false,
  reason,
  summary,
  live,
  tags,
  meta,
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
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <span className={cx('title', monospaceTitle && 'titleMono')}>{title}</span>
        {!!reason && <span className={styles.reason}>{reason}</span>}
        {!!summary && <span className={styles.summary}>{summary}</span>}
        {!!live && (
          <span className={styles.live} data-slot="execution-step-live">
            {liveOutputLines(live).map((line, index) => (
              // 只显示末尾几行、整段随新输出替换，行的序号就是它的身份。
              <span key={index} className={styles.liveLine}>
                {line}
              </span>
            ))}
          </span>
        )}
      </span>
      {tags}
      {!!meta && <span className={styles.meta}>{meta}</span>}
      <span className={styles.statusLabel}>{statusLabel}</span>
      <span className={cx('caret', expanded && 'caretExpanded')} aria-hidden="true">
        <CaretRightIcon size={12} weight="bold" />
      </span>
    </button>
  )

  return (
    <div className={styles.root} data-slot={slot} data-tone={tone}>
      {header}
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

/** 运行中的输出只露最后几行：空行不占位置，每行过长的在行尾省略。 */
function liveOutputLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(isNonBlankString)
    .slice(-LiveOutputLines)
}

/**
 * 详情里的一段代码、参数、返回或错误：等宽正文，给了语言就按语法着色；给了标签时左边一列小标签。
 * 长的先折起来，通过代码块共用的底部图标展开与收起。
 */
export function ExecutionStepPayload({
  label,
  text,
  language,
  tone = 'default',
}: {
  label?: string
  text: string
  /** 按哪种语言着色；不给就按纯文本显示，错误一律纯文本。 */
  language?: LooseOptional<ExecutionStepCodeLanguage>
  tone?: 'default' | 'error'
}): ReactElement {
  const { t } = useConversationI18n()
  const [expanded, setExpanded] = useState(false)
  const foldable = isLongExecutionPayload(text)
  const highlighted = useHighlightedCode(text, optionalWhen(tone !== 'error', language))

  return (
    <div className={cx('payload', !label && 'payloadBare')}>
      {!!label && <span className={styles.payloadLabel}>{label}</span>}
      <div className={styles.payloadBody} data-expanded={expanded}>
        <pre
          className={cx(
            'payloadText',
            tone === 'error' && 'payloadTextError',
            foldable && !expanded && 'payloadTextFolded'
          )}
        >
          {highlighted ? <HighlightedLines code={highlighted} /> : text}
        </pre>
        {foldable && (
          <ExpandableContentControls
            expanded={expanded}
            expandLabel={t('executionStep.expandPayload')}
            collapseLabel={t('executionStep.collapsePayload')}
            onExpandedChange={setExpanded}
          />
        )}
      </div>
    </div>
  )
}

/** 着过色的代码：一行一组分词，行与行之间补回换行。 */
export function HighlightedLines({ code }: { code: HighlightedCode }): ReactElement {
  return (
    <code>
      {code.tokens.map((line, index) => (
        // 分词结果随正文整段重算，行的序号就是它的身份。
        <Fragment key={index}>
          {index > 0 && '\n'}
          {line.map((token, position) => (
            <span key={position} className={styles.token} style={highlightedTokenStyle(token)}>
              {token.content}
            </span>
          ))}
        </Fragment>
      ))}
    </code>
  )
}
