import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { UserActionCard } from '../../packages/ui/src/conversation/cards/UserActionCard'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
  conversationZhCNMessages,
} from '../../packages/ui/src/conversation/i18n'
import type { UserActionCardView } from '../../packages/ui/src/conversation/projection/userActionCardView'

function lookupMessage(key: string): string {
  let node: unknown = conversationZhCNMessages
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  return typeof node === 'string' ? node : key
}

const i18n: ConversationI18nContextValue = {
  locale: 'zh-CN',
  setLocale: async () => undefined,
  t: (key) => lookupMessage(key),
}

const noop = (): void => undefined

function formView(actions: UserActionCardView['card']['actions']): UserActionCardView {
  const fields = [
    {
      id: 'choices',
      type: 'radio' as const,
      label: '',
      required: true,
      options: [
        { value: 'staging', label: '预发环境', recommended: true },
        { value: 'production', label: '生产环境' },
      ],
    },
  ]
  return {
    card: {
      id: 'interaction:ask-1',
      title: '改动先应用到哪个环境？',
      description: '',
      tone: 'info',
      icon: 'info',
      blocking: true,
      actions,
      form: { fields },
      createdAt: 0,
    },
    isHidden: false,
    isConsumed: false,
    isTimedOut: false,
    interactionDisabled: false,
    formFields: fields,
    actionEntries: actions.map((action, index) => ({ action, key: `${action.kind}:${index}` })),
    completedActionKey: null,
    pendingActionKey: null,
    settled: false,
    formValues: {},
    formErrors: {},
    inputValue: '',
    timeoutPaused: false,
    effectiveTimeoutMs: null,
    autoCollapsed: false,
    activeInputEntry: null,
    completedEntry: null,
    shouldShowCardActions: true,
    shouldShowSkipButton: false,
    setInputValue: noop,
    setTimeoutPaused: noop,
    expandCard: noop,
    handleFormFieldChange: noop,
    submitAction: noop,
    skipCard: noop,
    cancelInput: noop,
    isInputSubmitDisabled: () => false,
    isActionButtonDisabled: () => false,
    isFormDisabled: false,
    isInputPanelDisabled: false,
  }
}

function render(view: UserActionCardView): string {
  return renderToStaticMarkup(
    createElement(ConversationLocalizationProvider, { value: i18n }, createElement(UserActionCard, { view }))
  )
}

void test('a form card shows its question above the fields and offers skip when it has a reject action', () => {
  const markup = render(
    formView([
      { kind: 'submit_form', label: 'Submit' },
      { kind: 'reject', label: 'Skip' },
    ])
  )
  assert.match(markup, /改动先应用到哪个环境？/)
  assert.match(markup, /预发环境/)
  assert.match(markup, new RegExp(lookupMessage('common.skip')))
  assert.match(markup, new RegExp(lookupMessage('userActionForm.submit')))
})

void test('a form card without a reject action has no skip button', () => {
  const markup = render(formView([{ kind: 'submit_form', label: 'Submit' }]))
  assert.doesNotMatch(markup, new RegExp(`>${lookupMessage('common.skip')}<`))
})
