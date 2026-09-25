/**
 * 交互卡的纯展示逻辑：底色、标题、轮播里的题目、草稿与回答互转、收起后那一行回答。选择题与表单题交给
 * 轮播提问卡作答；表单里的真假题画成「是 / 否」两个选项，数字题是一行只收数的输入。
 */
import type { ConversationI18nContextValue, ConversationMessageKey } from '../i18n'

import type { AskUserDraft, AskUserQuestion } from './AskUserCarousel'
import type { ExecutionFrameTone } from './executionStepPresentation'

import type {
  InteractionAnswer,
  InteractionBlock,
  InteractionField,
  InteractionKind,
  InteractionStatus,
  InteractionValue,
} from '#contracts'
import { isArray, isBlank, isBoolean, isEmpty, isPresent, isString, isUndefined } from '#internal/runtime'

type Translate = ConversationI18nContextValue['t']

/** 选择题在轮播里只有一道题，这是它的身份。 */
const ChoiceQuestionId = 'choice'
/** 真假题的两个选项。 */
const TrueOptionId = 'true'
const FalseOptionId = 'false'

const ToneByStatus = {
  pending: 'waiting',
  answered: 'success',
  declined: 'error',
  expired: 'cancelled',
} as const satisfies Record<InteractionStatus, ExecutionFrameTone>

/** 卡片底色：等回答淡蓝，答了淡绿，拒绝或跳过淡红，失效淡灰。 */
export function resolveInteractionTone(status: InteractionStatus): ExecutionFrameTone {
  return ToneByStatus[status]
}

/** 确认一类的卡说「批准 / 拒绝」，提问一类说「回答 / 跳过」，登录墙说「继续 / 取消」。 */
function isConfirmKind(kind: InteractionKind): boolean {
  return kind === 'confirm' || kind === 'danger'
}

/** 状态的文字：写在收起后那一行的右边。 */
export function resolveInteractionStatusKey(
  block: Pick<InteractionBlock, 'kind' | 'status'>
): ConversationMessageKey {
  switch (block.status) {
    case 'pending':
      return 'interaction.statusWaiting'
    case 'expired':
      return 'interaction.statusExpired'
    case 'answered':
      if (block.kind === 'login') return 'interaction.statusContinued'
      return isConfirmKind(block.kind) ? 'interaction.statusApproved' : 'interaction.statusAnswered'
    case 'declined':
      if (block.kind === 'login') return 'interaction.statusCancelled'
      return isConfirmKind(block.kind) ? 'interaction.statusRejected' : 'interaction.statusSkipped'
  }
}

const KindTitleKeys = {
  choice: 'interaction.kindChoice',
  form: 'interaction.kindForm',
  input: 'interaction.kindInput',
  confirm: 'interaction.kindConfirm',
  danger: 'interaction.kindDanger',
  login: 'interaction.kindLogin',
  capability: 'interaction.kindCapability',
} as const satisfies Record<InteractionKind, ConversationMessageKey>

/** 卡片标题：说明的第一行；说明是空的时候说这是哪种请求。 */
export function resolveInteractionTitle(
  block: Pick<InteractionBlock, 'kind' | 'message'>,
  t: Translate
): string {
  return splitInteractionMessage(block.message).title || t(KindTitleKeys[block.kind])
}

/** 说明拆成标题（第一行有字的）与其余的话；其余的话保留原来的换行。 */
export function splitInteractionMessage(message: string): { title: string; rest: string } {
  const lines = message.split('\n')
  const index = lines.findIndex((line) => !isBlank(line.trim()))
  if (index < 0) return { title: '', rest: '' }
  return { title: lines[index]!.trim(), rest: lines.slice(index + 1).join('\n').trim() }
}

/** 选择题是一道题；表单题每一项是一道题。 */
export function buildInteractionQuestions(
  block: Pick<InteractionBlock, 'kind' | 'message' | 'options' | 'multiple' | 'allowText' | 'fields'>,
  t: Translate
): AskUserQuestion[] {
  if (block.kind === 'choice')
    return [
      {
        id: ChoiceQuestionId,
        label: block.message,
        options: block.options ?? [],
        multiple: !!block.multiple,
        allowText: !!block.allowText,
        placeholder: t('interaction.otherPlaceholder'),
        required: true,
      },
    ]
  return (block.fields ?? []).map((field) => fieldQuestion(field, t))
}

function fieldQuestion(field: InteractionField, t: Translate): AskUserQuestion {
  const question: AskUserQuestion = { id: field.id, label: field.label, required: !!field.required }
  if (field.placeholder) question.placeholder = field.placeholder
  switch (field.kind) {
    case 'choice':
      question.options = field.options ?? []
      question.multiple = !!field.multiple
      return question
    case 'boolean':
      question.options = [
        { id: TrueOptionId, label: t('interaction.yes') },
        { id: FalseOptionId, label: t('interaction.no') },
      ]
      return question
    case 'number':
      question.numeric = true
      return question
    case 'text':
      return question
  }
}

/** 作答草稿转成回答：选择题给选中的 id 与另写的话，表单题给每一项的值（没答的项不带）。 */
export function buildInteractionAnswer(
  block: Pick<InteractionBlock, 'kind' | 'fields'>,
  drafts: Readonly<Record<string, AskUserDraft>>
): InteractionAnswer {
  if (block.kind === 'choice') {
    const draft = drafts[ChoiceQuestionId]
    const answer: InteractionAnswer = { choices: draft?.choices ?? [] }
    const text = draft?.text.trim()
    if (text) answer.text = text
    return answer
  }
  const values: Record<string, InteractionValue> = {}
  for (const field of block.fields ?? []) {
    const value = fieldValue(field, drafts[field.id])
    if (isPresent(value)) values[field.id] = value
  }
  return { values }
}

function fieldValue(
  field: InteractionField,
  draft: LooseOptional<AskUserDraft>
): InteractionValue | undefined {
  if (!draft) return undefined
  const text = draft.text.trim()
  switch (field.kind) {
    case 'choice':
      if (isEmpty(draft.choices)) return undefined
      return field.multiple ? draft.choices : draft.choices[0]
    case 'boolean':
      return isEmpty(draft.choices) ? undefined : draft.choices[0] === TrueOptionId
    case 'number': {
      const value = Number(text)
      return text && Number.isFinite(value) ? value : undefined
    }
    case 'text':
      return text || undefined
  }
}

/** 已经给出的回答放回轮播，收起的卡点开后照原样回看。 */
export function buildInteractionDrafts(
  block: Pick<InteractionBlock, 'kind' | 'fields' | 'answer'>
): Record<string, AskUserDraft> {
  const answer = block.answer
  if (!answer) return {}
  if (block.kind === 'choice')
    return { [ChoiceQuestionId]: { choices: answer.choices ?? [], text: answer.text ?? '' } }
  const drafts: Record<string, AskUserDraft> = {}
  for (const field of block.fields ?? []) {
    const value = answer.values?.[field.id]
    if (isUndefined(value)) continue
    drafts[field.id] = valueDraft(field, value)
  }
  return drafts
}

function valueDraft(field: InteractionField, value: InteractionValue): AskUserDraft {
  if (isArray(value)) return { choices: value, text: '' }
  if (isBoolean(value)) return { choices: [value ? TrueOptionId : FalseOptionId], text: '' }
  if (field.kind === 'choice' && isString(value)) return { choices: [value], text: '' }
  return { choices: [], text: String(value) }
}

/**
 * 收起后那一行：答了就写答了什么（选了哪些、填了什么、写了什么），确认一类只写「已批准」「已继续」；
 * 拒绝或跳过写明，带上理由；失效就写失效。
 */
export function describeInteractionOutcome(
  block: Pick<InteractionBlock, 'kind' | 'options' | 'fields' | 'status' | 'answer'>,
  t: Translate
): string {
  const status = t(resolveInteractionStatusKey(block))
  if (block.status === 'answered') return summarizeInteractionAnswer(block, t) || status
  const reason = block.status === 'declined' ? block.answer?.reason?.trim() : undefined
  return reason ? t('interaction.withReason', { status, reason }) : status
}

function summarizeInteractionAnswer(
  block: Pick<InteractionBlock, 'kind' | 'options' | 'fields' | 'answer'>,
  t: Translate
): string {
  const answer = block.answer
  if (!answer) return ''
  const separator = t('common.shortListSeparator')
  switch (block.kind) {
    case 'choice':
      return [...optionLabels(block.options, answer.choices), answer.text?.trim() ?? '']
        .filter((part) => !isBlank(part))
        .join(separator)
    case 'form':
      return (block.fields ?? [])
        .flatMap((field) => {
          const value = answer.values?.[field.id]
          return isUndefined(value) ? [] : [`${field.label} ${formatFieldValue(field, value, t)}`]
        })
        .join(separator)
    case 'input':
    case 'capability':
      return answer.text?.trim() ?? ''
    default:
      return ''
  }
}

function optionLabels(
  options: LooseOptional<InteractionBlock['options']>,
  ids: LooseOptional<string[]>
): string[] {
  return (ids ?? []).map((id) => options?.find((option) => option.id === id)?.label ?? id)
}

function formatFieldValue(field: InteractionField, value: InteractionValue, t: Translate): string {
  if (isBoolean(value)) return t(value ? 'interaction.yes' : 'interaction.no')
  if (isArray(value)) return optionLabels(field.options, value).join(t('common.shortListSeparator'))
  if (isString(value) && field.kind === 'choice') return optionLabels(field.options, [value]).join('')
  return String(value)
}
