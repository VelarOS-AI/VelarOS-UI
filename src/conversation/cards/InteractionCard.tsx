/**
 * 交互卡：模型的提问、表单、确认与能力申请，宿主的危险命令确认与登录墙，每个请求一张，画在运行消息里。
 * 等回答时展开：选择题与表单题是轮播提问卡；一句话的提问与能力申请是一个输入框；确认一类（含危险命令）
 * 是一行标题加两个按钮，登录墙的按钮叫「继续」。已填写的表单与选择题直接展示只读轮播；
 * 其余回执收成一行，写明结果并可点开回看。底色表状态，左边的图标表种类。
 */
import {
  type KeyboardEvent,
  memo,
  type ReactElement,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ChatCircleTextIcon,
  ListChecksIcon,
  PuzzlePieceIcon,
  SealQuestionIcon,
  SignInIcon,
  TextboxIcon,
  WarningIcon,
} from '@phosphor-icons/react'

import { StyleUtils } from '@velaros-ai/ui'
import { Textarea } from '@velaros-ai/ui/primitives/forms/Textarea'
import { CardTextButton } from '@velaros-ai/ui/product/layout/CardKit'

import { useConversationI18n } from '../i18n'

import { AskUserCarousel, type AskUserDraft } from './AskUserCarousel'
import { ExecutionStepFrame } from './ExecutionStepFrame'
import { useInteractionAnswer } from './interactionAnswerContext'
import {
  buildInteractionAnswer,
  buildInteractionDrafts,
  buildInteractionQuestions,
  describeInteractionOutcome,
  resolveInteractionStatusKey,
  resolveInteractionTitle,
  resolveInteractionTone,
  splitInteractionMessage,
} from './interactionPresentation'
import { useAutoResize } from './useAutoResize'

import stepStyles from './ExecutionStep.module.css'
import styles from './InteractionCard.module.css'

import type { InteractionAnswer, InteractionBlock, InteractionKind } from '#contracts'
import { isBlank } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)

/** 标题行图标的尺寸，与脚本卡一致。 */
const IconSize = 13

const KindIcons = {
  choice: ListChecksIcon,
  form: TextboxIcon,
  input: ChatCircleTextIcon,
  confirm: SealQuestionIcon,
  danger: WarningIcon,
  login: SignInIcon,
  capability: PuzzlePieceIcon,
} as const satisfies Record<InteractionKind, typeof WarningIcon>

/** 回答框最多长到这么高，再多就在框里滚。 */
const AnswerMaxHeight = 160

function KindIcon({ kind }: { kind: InteractionKind }): ReactElement {
  const Icon = KindIcons[kind]
  return <Icon size={IconSize} />
}

export interface InteractionCardProps {
  block: InteractionBlock
}

function InteractionCardInner({ block }: InteractionCardProps): ReactElement {
  const answer = useInteractionAnswer()
  if (block.status === 'pending' && answer)
    return <PendingInteraction block={block} onAnswer={(value) => answer(block.id, value)} />
  return <SettledInteraction block={block} />
}

interface PendingProps {
  block: InteractionBlock
  onAnswer: (answer: InteractionAnswer) => Promise<void> | void
}

/** 交回答期间锁住整张卡，交完（成功或失败）再放开；失败由宿主提示，卡还能再答。 */
function useSubmission(onAnswer: PendingProps['onAnswer']): {
  submitting: boolean
  submit: (answer: InteractionAnswer) => void
} {
  const [submitting, setSubmitting] = useState(false)
  const submit = (answer: InteractionAnswer): void => {
    if (submitting) return
    setSubmitting(true)
    void Promise.resolve(onAnswer(answer)).finally(() => setSubmitting(false))
  }
  return { submitting, submit }
}

function PendingInteraction({ block, onAnswer }: PendingProps): ReactElement {
  switch (block.kind) {
    case 'choice':
    case 'form':
      return <PendingQuestion block={block} onAnswer={onAnswer} />
    case 'input':
    case 'capability':
      return <PendingTextAnswer block={block} onAnswer={onAnswer} />
    case 'confirm':
    case 'danger':
    case 'login':
      return <PendingConfirmation block={block} onAnswer={onAnswer} />
  }
}

/** 选择题与表单题：轮播提问卡，逐题作答，最后一页发送。 */
function PendingQuestion({ block, onAnswer }: PendingProps): ReactElement {
  const { t } = useConversationI18n()
  const { submitting, submit } = useSubmission(onAnswer)
  const [drafts, setDrafts] = useState<Record<string, AskUserDraft>>({})
  const questions = useMemo(() => buildInteractionQuestions(block, t), [block, t])

  return (
    <div
      className={styles.question}
      data-slot="interaction"
      data-kind={block.kind}
      data-status="pending"
    >
      <AskUserCarousel
        intro={block.kind === 'form' ? block.message : undefined}
        questions={questions}
        drafts={drafts}
        locked={submitting}
        onChange={(id, draft) => setDrafts((current) => ({ ...current, [id]: draft }))}
        onSend={() => submit(buildInteractionAnswer(block, drafts))}
        onSkip={() => submit({ declined: true })}
      />
    </div>
  )
}

/**
 * 等回答时的外框：左边图标，第一行说明做标题，下面是作答区。确认、危险命令与登录墙只有一行标题（太长截断），
 * 其余的说明与命令全文不摊开，回答过之后点开回看；一句话的提问与能力申请才把其余的说明写在标题下面。
 */
function PendingFrame({
  block,
  children,
}: {
  block: InteractionBlock
  children: ReactNode
}): ReactElement {
  const { t } = useConversationI18n()
  const titleOnly = block.kind === 'confirm' || block.kind === 'danger' || block.kind === 'login'
  const { rest } = splitInteractionMessage(block.message)

  return (
    <div
      className={stepStyles.root}
      data-slot="interaction"
      data-kind={block.kind}
      data-status="pending"
      data-tone="waiting"
    >
      <div className={styles.pendingHeader}>
        <span className={stepStyles.icon} aria-hidden="true">
          <KindIcon kind={block.kind} />
        </span>
        <span className={cx('pendingTitle', titleOnly && 'pendingTitleSingle')}>
          {resolveInteractionTitle(block, t)}
        </span>
      </div>
      <div className={styles.pendingBody}>
        {!titleOnly && !!rest && <p className={styles.message}>{rest}</p>}
        {children}
      </div>
    </div>
  )
}

/** 一句话的提问与能力申请：写一段话回答，回车发送，Shift+回车换行；输入框与跳过、发送在同一行。 */
function PendingTextAnswer({ block, onAnswer }: PendingProps): ReactElement {
  const { t } = useConversationI18n()
  const { submitting, submit } = useSubmission(onAnswer)
  const [text, setText] = useState('')
  const composingRef = useRef(false)
  const textareaRef = useAutoResize(text, { maxHeight: AnswerMaxHeight })
  const canSend = !submitting && !isBlank(text.trim())
  const send = (): void => {
    if (canSend) submit({ text: text.trim() })
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (composingRef.current || event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    send()
  }

  return (
    <PendingFrame block={block}>
      <div className={styles.answerRow}>
        <Textarea
          ref={textareaRef}
          rows={1}
          size="sm"
          className={styles.answer}
          value={text}
          placeholder={t('interaction.answerPlaceholder')}
          disabled={submitting}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
        />
        <div className={styles.actions}>
          <CardTextButton disabled={submitting} onClick={() => submit({ declined: true })}>
            {t('common.skip')}
          </CardTextButton>
          <CardTextButton tone="approve" disabled={!canSend} onClick={send}>
            {t('userActionForm.wizardSend')}
          </CardTextButton>
        </div>
      </div>
    </PendingFrame>
  )
}

/** 确认、危险命令与登录墙：一行标题加两个按钮。 */
function PendingConfirmation({ block, onAnswer }: PendingProps): ReactElement {
  const { t } = useConversationI18n()
  const { submitting, submit } = useSubmission(onAnswer)
  const login = block.kind === 'login'

  return (
    <PendingFrame block={block}>
      <div className={styles.actions}>
        <CardTextButton
          tone={login ? 'neutral' : 'reject'}
          disabled={submitting}
          onClick={() => submit({ declined: true })}
        >
          {t(login ? 'common.cancel' : 'common.reject')}
        </CardTextButton>
        <CardTextButton
          tone="approve"
          disabled={submitting}
          onClick={() => submit({ approved: true })}
        >
          {t(login ? 'interaction.continue' : 'common.approve')}
        </CardTextButton>
      </div>
    </PendingFrame>
  )
}

/** 危险命令的命令与它的工作目录。 */
function InteractionOperation({
  operation,
}: {
  operation: NonNullable<InteractionBlock['operation']>
}): ReactElement {
  const { t } = useConversationI18n()

  return (
    <div className={styles.operation}>
      <code className={styles.operationCommand}>{operation.label}</code>
      {!!operation.target && (
        <span className={styles.operationTarget}>
          {t('interaction.operationTarget', { target: operation.target })}
        </span>
      )}
    </div>
  )
}

/** 已填写的表单直接回看答案；其他回执用一行标题与结果提供折叠详情。 */
function SettledInteraction({ block }: InteractionCardProps): ReactElement {
  const { t } = useConversationI18n()

  if (block.status === 'answered' && (block.kind === 'form' || block.kind === 'choice'))
    return (
      <div
        className={styles.question}
        data-slot="interaction"
        data-kind={block.kind}
        data-status={block.status}
      >
        <InteractionDetails block={block} />
      </div>
    )

  return (
    <ExecutionStepFrame
      slot="interaction"
      tone={resolveInteractionTone(block.status)}
      statusLabel={t(resolveInteractionStatusKey(block))}
      icon={<KindIcon kind={block.kind} />}
      title={resolveInteractionTitle(block, t)}
      summary={describeInteractionOutcome(block, t)}
      renderDetails={() => <InteractionDetails block={block} />}
    />
  )
}

/** 答案回看：选择题与表单题是只读轮播，其余展示完整说明、写下的回答或拒绝理由。 */
function InteractionDetails({ block }: InteractionCardProps): ReactElement {
  const { t } = useConversationI18n()
  const questions = useMemo(() => buildInteractionQuestions(block, t), [block, t])

  if (block.kind === 'choice' || block.kind === 'form')
    return (
      <AskUserCarousel
        intro={block.kind === 'form' ? block.message : undefined}
        questions={questions}
        drafts={buildInteractionDrafts(block)}
        locked
      />
    )

  const reply = block.answer?.declined ? block.answer.reason : block.answer?.text
  return (
    <>
      <p className={styles.message}>{block.message}</p>
      {!!block.operation && <InteractionOperation operation={block.operation} />}
      {!!reply && <p className={styles.reply}>{reply}</p>}
    </>
  )
}

export const InteractionCard = memo(InteractionCardInner)

InteractionCard.displayName = 'InteractionCard'
