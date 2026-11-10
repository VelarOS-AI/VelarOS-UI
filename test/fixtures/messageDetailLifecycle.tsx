import React from 'react'
import { createRoot } from 'react-dom/client'

import { MessageContentBlock } from '../../src/conversation/blocks/MessageContentBlock'
import { InteractionAnswerProvider } from '../../src/conversation/cards/interactionAnswerContext'
import { InteractionCard } from '../../src/conversation/cards/InteractionCard'
import { ToolCallStepCard } from '../../src/conversation/cards/ToolCallStepCard'
import type { InteractionAnswer, ToolCallBlock } from '../../src/conversation/contracts'
import { ConversationLocalizationProvider } from '../../src/conversation/i18n'

import '../../src/styles/tokens/design-tokens.css'
import '../../src/styles/components/conversation-basic.css'

const root = createRoot(document.getElementById('root')!)
const answers: InteractionAnswer[] = []
async function settle(): Promise<void> { for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame) }
async function render(content: React.ReactNode): Promise<void> {
  root.render(<ConversationLocalizationProvider value={{ locale: 'en-US', t: (key: string) => key }}>{content}</ConversationLocalizationProvider>)
  await settle()
}
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
async function waitFor(condition: () => boolean, label: string): Promise<void> {
  for (let frame = 0; frame < 120; frame++) {
    if (condition()) return
    await new Promise(requestAnimationFrame)
  }
  throw Error(`Timed out: ${label}`)
}
function enter(options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options })
  document.querySelector('textarea')!.dispatchEvent(event)
  return event
}
async function verifyComposition(): Promise<void> {
  for (const kind of ['input', 'capability'] as const) {
    await render(<InteractionAnswerProvider value={(_id, answer) => { answers.push(answer) }}>
      <InteractionCard key={kind} block={{ type: 'interaction', id: kind, kind, message: 'Answer this question', status: 'pending' }} />
    </InteractionAnswerProvider>)
    const input = document.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, '中文回答')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    const before = answers.length
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(!enter({ isComposing: true }).defaultPrevented, 'Composition Enter must remain available to the input method')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(!enter({ keyCode: 229 }).defaultPrevented, 'A trailing IME 229 Enter must not submit')
    enter({ repeat: true })
    enter({ shiftKey: true })
    await settle()
    expect(answers.length === before, 'Composition, repeat and Shift+Enter must not deliver an answer')
    expect(enter({ keyCode: 13 }).defaultPrevented, 'Ordinary Enter must retain submit behavior')
    await settle()
    expect(answers.length === before + 1 && answers.at(-1)?.text === '中文回答', 'Ordinary Enter must submit the current answer exactly once')
  }
}
async function verifyToolBounds(): Promise<void> {
  for (const [argumentSize, resultSize, expectedNotes] of [[8000, 8000, 0], [8001, 8000, 1], [8000, 8001, 1], [8001, 8001, 2]]) {
    const overhead = JSON.stringify({ value: '' }, null, 2).length
    const block: ToolCallBlock = {
      type: 'tool-call', toolCallId: `tool-${argumentSize}-${resultSize}`, toolName: 'project:read',
      args: { value: 'A'.repeat(argumentSize - overhead) }, result: 'B'.repeat(resultSize), isRunning: false,
    }
    await render(<ToolCallStepCard key={block.toolCallId} block={block} />)
    document.querySelector<HTMLButtonElement>('[data-slot="tool-call-step"] > button')!.click()
    await settle()
    const notes = Array.from(document.querySelectorAll('p')).filter((node) => node.textContent === 'scriptExecution.sourceTruncated')
    expect(notes.length === expectedNotes, 'Each bounded payload must disclose truncation only when it exceeds 8000 characters')
    for (const button of document.querySelectorAll<HTMLButtonElement>('[aria-label="executionStep.expandPayload"]')) button.click()
    await settle()
    expect(Array.from(document.querySelectorAll('pre')).every((node) => node.textContent!.length <= 8000), 'Expanding a preview must retain the existing character budget')
  }
}

const longMarkdown = ['```text', ...Array.from({ length: 70 }, (_, index) => `line ${index}`), '```', '', '| Name | Value |', '| --- | --- |', ...Array.from({ length: 45 }, (_, index) => `| row ${index} | value |`)].join('\n')
async function markdown(id: string, isStreaming: boolean, text = longMarkdown): Promise<void> {
  await render(<MessageContentBlock key={id} block={{ type: 'text', text }} sessionId="detail-regression" messageId={id}
    blockIndex={0} blockAnimationKey="body" isStreaming={isStreaming} animateStreamingText={isStreaming} />)
  await waitFor(() => !!document.querySelector('[data-expandable-viewport="table"]'), 'Markdown table mount')
  await settle()
}
async function expandMarkdown(): Promise<void> {
  await waitFor(() => document.querySelectorAll('[data-expandable-viewport] button[aria-expanded="false"]').length === 2, 'Both long Markdown viewports overflow')
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-expandable-viewport] button[aria-expanded="false"]')) button.click()
  await settle()
}
async function expectMarkdownExpanded(label: string): Promise<void> {
  await waitFor(() => document.querySelectorAll('[data-expandable-viewport] button[aria-expanded="true"]').length === 2, label)
  expect(document.querySelectorAll('[data-expandable-viewport][data-collapsed="true"]').length === 0, label)
}
async function verifyMarkdownIdentity(): Promise<void> {
  await markdown('streamed', true)
  await expandMarkdown()
  await markdown('streamed', false)
  await expectMarkdownExpanded('Completion preserves the live expanded viewports')
  await render(null)
  await markdown('streamed', false)
  await expectMarkdownExpanded('A static remount restores the same message block expansion')
  await render(null)
  await markdown('historical', false)
  await expandMarkdown()
  await render(null)
  await markdown('historical', false)
  await expectMarkdownExpanded('Initially static history also retains expansion after unmount')
  await markdown('short', false, '```text\nshort\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
  expect(document.querySelectorAll('[data-expandable-viewport] button[aria-expanded]').length === 0, 'Short content must not acquire expansion controls')
}

Object.assign(window, {
  async runMessageDetailRegression(): Promise<string[]> {
    await verifyComposition()
    await verifyToolBounds()
    await verifyMarkdownIdentity()
    root.unmount()
    return ['IME-safe input and capability answers', 'bounded tool previews disclose truncation', 'live and static Markdown retain message-scoped expansion']
  },
})
