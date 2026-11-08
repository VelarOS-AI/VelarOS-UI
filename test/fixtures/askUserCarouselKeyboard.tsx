import { type ReactElement, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import {
  AskUserCarousel,
  type AskUserDraft,
  type AskUserQuestion,
} from '../../src/conversation/cards/AskUserCarousel'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
} from '../../src/conversation/i18n'

const i18n: ConversationI18nContextValue = {
  locale: 'en-US',
  setLocale: async () => undefined,
  t: (key) => key,
}
const first: AskUserQuestion = { id: 'first', label: 'First question', required: true }
const last: AskUserQuestion = { id: 'last', label: 'Last question', required: true }
const choice: AskUserQuestion = {
  id: 'choice',
  label: 'Choose a route',
  required: true,
  allowText: true,
  options: [{ id: 'safe', label: 'Safe route' }],
}
const numeric: AskUserQuestion = {
  id: 'number',
  label: 'How many?',
  required: true,
  numeric: true,
}
const scenarios = {
  single: [first],
  multiple: [first, last],
  choice: [choice],
  numeric: [numeric],
  prevented: [first],
  locked: [first, last],
} satisfies Record<string, AskUserQuestion[]>
type Scenario = keyof typeof scenarios

const container = document.getElementById('root')!
const root = createRoot(container)
let renderKey = 0
let submitted: Array<Record<string, AskUserDraft>> = []
let skips = 0

function Harness({ scenario }: { scenario: Scenario }): ReactElement {
  const [drafts, setDrafts] = useState<Record<string, AskUserDraft>>(
    scenario === 'locked' ? { first: { choices: [], text: 'Saved answer' } } : {}
  )
  const [locked, setLocked] = useState(scenario === 'locked')
  return (
    <ConversationLocalizationProvider value={i18n}>
      <section
        onKeyDownCapture={(event) => {
          if (scenario === 'prevented') event.preventDefault()
        }}
      >
        <AskUserCarousel
          questions={scenarios[scenario]}
          drafts={drafts}
          locked={locked}
          onChange={(id, draft) => setDrafts((current) => ({ ...current, [id]: draft }))}
          onSend={() => {
            submitted.push(structuredClone(drafts))
            setLocked(true)
          }}
          onSkip={() => {
            skips += 1
          }}
        />
      </section>
    </ConversationLocalizationProvider>
  )
}

function render(scenario: Scenario): void {
  submitted = []
  skips = 0
  flushSync(() => root.render(<Harness key={++renderKey} scenario={scenario} />))
}

function input(): HTMLInputElement {
  const element = container.querySelector('input')
  if (!element) throw new Error('The current question has no text input')
  return element
}

function fill(text: string): void {
  const field = input()
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  flushSync(() => {
    setter.call(field, text)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function dispatchKey(options: KeyboardEventInit): boolean {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...options,
  })
  flushSync(() => input().dispatchEvent(event))
  return event.defaultPrevented
}

function click(label: string): void {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  )
  if (!button) throw new Error(`Missing button: ${label}`)
  flushSync(() => button.click())
}

function read() {
  return {
    isLastQuestion: container.textContent?.includes(last.label) ?? false,
    input: container.querySelector('input')?.value ?? null,
    inputDisabled: container.querySelector('input')?.disabled ?? null,
    submitted,
    skips,
  }
}

Object.assign(window, {
  carouselKeyboardProof: {
    render,
    fill,
    dispatchKey,
    click,
    read,
  },
})
