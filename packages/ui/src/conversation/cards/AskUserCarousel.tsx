import { type ReactElement, useState } from 'react'
import { CaretLeftIcon, CaretRightIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react'

import { StyleUtils } from '@velaros-ai/ui'
import { Button } from '@velaros-ai/ui/primitives/buttons/Button'
import { Input } from '@velaros-ai/ui/primitives/forms/Input'

import { useConversationI18n } from '../i18n'

import styles from './UserActionCard.module.css'

import type { InteractionOption } from '#contracts'
import { isBlank, isEmpty } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)

/** 轮播里的一道题：给了选项就是选择题，没给就是一道填空题。 */
export interface AskUserQuestion {
  id: string
  /** 题面，多行照原样换行。 */
  label: string
  options?: readonly InteractionOption[]
  multiple?: boolean
  /** 选择题下面可以另写一句；填空题本身就是这一行。 */
  allowText?: boolean
  placeholder?: string
  /** 填空题要的是一个数。 */
  numeric?: boolean
  /** 没答这道题就不能发送。 */
  required?: boolean
}

/** 一道题的作答：选中的选项 id，加上写下的话。 */
export interface AskUserDraft {
  choices: string[]
  text: string
}

export const EmptyAskUserDraft: AskUserDraft = Object.freeze({ choices: [], text: '' })

/** 选了至少一项，或者写了字，就算答过这道题。 */
export function isAskUserDraftAnswered(draft: LooseOptional<AskUserDraft>): boolean {
  return !!draft && (!isEmpty(draft.choices) || !isBlank(draft.text.trim()))
}

/** 必答的题都答了才能发送。 */
export function canSendAskUserDrafts(
  questions: readonly AskUserQuestion[],
  drafts: Readonly<Record<string, AskUserDraft>>
): boolean {
  return questions.every((question) => !question.required || isAskUserDraftAnswered(drafts[question.id]))
}

/**
 * 提问卡：多道题放进一个左右切换的轮播，逐题作答，最后一页统一发送；只有一道题时不显示页码与翻页。
 * 锁住（答过、失效或正在交）后选择与发送都停用，仍能翻页回看每道题的答案。
 */
export function AskUserCarousel({
  intro,
  questions,
  drafts,
  locked,
  onChange,
  onSend,
  onSkip,
}: {
  /** 整组题前面的一段说明，多行照原样换行。 */
  intro?: LooseOptional<string>
  questions: readonly AskUserQuestion[]
  drafts: Readonly<Record<string, AskUserDraft>>
  locked: boolean
  onChange?: (questionId: string, draft: AskUserDraft) => void
  onSend?: () => void
  /** 给了才有「跳过」：不答这一组题，让模型自己往下走。 */
  onSkip?: () => void
}): ReactElement {
  const { t } = useConversationI18n()
  const [pageIndex, setPageIndex] = useState(0)
  const safeIndex = Math.min(pageIndex, Math.max(0, questions.length - 1))
  const question = questions[safeIndex]
  const isLast = safeIndex >= questions.length - 1
  const paged = questions.length > 1
  const draft = (question && drafts[question.id]) ?? EmptyAskUserDraft
  const sendDisabled = locked || !canSendAskUserDrafts(questions, drafts)

  const update = (next: Partial<AskUserDraft>): void => {
    if (!question || locked) return
    onChange?.(question.id, { ...draft, ...next })
  }
  const toggleOption = (id: string): void => {
    const selected = draft.choices.includes(id)
    if (question?.multiple)
      update({ choices: selected ? draft.choices.filter((item) => item !== id) : [...draft.choices, id] })
    else update({ choices: selected ? [] : [id] })
  }

  const goPrev = (): void => setPageIndex(Math.max(0, safeIndex - 1))
  const goNext = (): void => setPageIndex(Math.min(questions.length - 1, safeIndex + 1))

  return (
    <div className={styles.cardFrame}>
      <div className={styles.wizardPanel}>
        {!!intro && <p className={styles.wizardIntro}>{intro}</p>}

        {paged && (
          <div className={styles.wizardStepRow}>
            <span className={styles.wizardStepLabel}>
              {t('userActionForm.wizardStep', {
                current: String(safeIndex + 1),
                total: String(questions.length),
              })}
            </span>
            <div className={styles.wizardDots} aria-hidden="true">
              {questions.map((item, index) => (
                <span
                  key={item.id}
                  className={cx(
                    'wizardDot',
                    index === safeIndex && 'wizardDotActive',
                    isAskUserDraftAnswered(drafts[item.id]) && 'wizardDotDone'
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {!!question && (
          <div className={styles.wizardQuestionBlock}>
            <div className={styles.wizardQuestionRow}>
              <span className={styles.wizardQuestionNo}>{safeIndex + 1}.</span>
              <span className={styles.wizardQuestion}>{question.label}</span>
              {!!question.options && (
                <span className={styles.wizardQuestionTag}>
                  {question.multiple ? t('userActionForm.wizardMulti') : t('userActionForm.wizardSingle')}
                </span>
              )}
              {/* 多道题里才分必答与选答；只有一道题时它就是要答的那道 */}
              {paged && !!question.required && (
                <span className={styles.wizardQuestionTag}>{t('interaction.required')}</span>
              )}
            </div>
            {!!question.options && (
              <div className={styles.optionButtons}>
                {question.options.map((option, optionIndex) => {
                  const selected = draft.choices.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cx('optionButton', selected && 'optionButtonSelected')}
                      disabled={locked}
                      aria-pressed={selected}
                      onClick={() => toggleOption(option.id)}
                    >
                      <span className={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</span>
                      <span className={styles.optionBody}>
                        <span className={styles.optionButtonHeader}>
                          <span className={styles.optionButtonLabel}>{option.label}</span>
                          {!!option.recommended && (
                            <span className={styles.formOptionRecommended}>
                              {t('userActionForm.recommended')}
                            </span>
                          )}
                        </span>
                        {!!option.description && (
                          <span className={styles.optionButtonDesc}>{option.description}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 回看时没写字的输入行不再占位置 */}
        {!!question && (!question.options || question.allowText) && !(locked && !draft.text) && (
          <Input
            size="sm"
            type={question.numeric ? 'number' : 'text'}
            className={styles.inputLine}
            disabled={locked}
            value={draft.text}
            placeholder={question.placeholder}
            onChange={(event) => update({ text: event.currentTarget.value })}
          />
        )}

        {(paged || !locked) && (
          <div className={styles.wizardNav}>
            {paged && (
              <Button
                size="sm"
                variant="ghost"
                className={styles.actionTextButton}
                disabled={safeIndex === 0}
                onClick={goPrev}
              >
                <span className={styles.actionTextButtonIcon} aria-hidden="true">
                  <CaretLeftIcon size={15} weight="bold" />
                </span>
                {t('userActionForm.wizardPrev')}
              </Button>
            )}

            <span className={styles.wizardNavSpacer} />

            {!!onSkip && !locked && (
              <Button size="sm" variant="ghost" className={styles.skipTextButton} onClick={onSkip}>
                {t('common.skip')}
              </Button>
            )}

            {!isLast ? (
              <Button size="sm" variant="ghost" className={styles.actionTextButton} onClick={goNext}>
                {t('userActionForm.wizardNext')}
                <span className={styles.actionTextButtonIcon} aria-hidden="true">
                  <CaretRightIcon size={15} weight="bold" />
                </span>
              </Button>
            ) : (
              !locked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.actionTextButton}
                  disabled={sendDisabled}
                  title={sendDisabled ? t('userActionForm.wizardIncomplete') : undefined}
                  onClick={onSend}
                >
                  <span className={styles.actionTextButtonIcon} aria-hidden="true">
                    <PaperPlaneTiltIcon size={15} weight="bold" />
                  </span>
                  {t('userActionForm.wizardSend')}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
