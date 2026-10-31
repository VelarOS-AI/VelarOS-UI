import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  ConversationBlockHooksProvider,
  emptyConversationBlockHooks,
} from '../src/conversation/blocks/conversationBlockHooks'
import { MessageBubble } from '../src/conversation/blocks/MessageBubble'
import type {
  ContentBlock,
  InteractionBlock,
  ScriptExecutionBlock,
} from '../src/conversation/contracts'
import { ConversationLocalizationProvider } from '../src/conversation/i18n'
import {
  ConversationRenderSlotsProvider,
  createConversationRenderSlots,
} from '../src/conversation/render-slots'

const script: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'dispatch-script',
  kind: 'execute',
  title: '派发子任务',
  status: 'succeeded',
  source: '',
  sourceTruncated: false,
  calls: [],
  durationMs: 10,
}
const approval: InteractionBlock = {
  type: 'interaction',
  id: 'approval',
  kind: 'danger',
  message: '批准命令标记',
  status: 'answered',
  answer: { approved: true },
}
const summary: ContentBlock = { type: 'text', text: '最终回答标记' }
const slots = createConversationRenderSlots({
  messageMarkdown: ({ text }) => createElement('p', null, text),
})

function render(
  blocks: ContentBlock[],
  running = false,
  unanchored = false,
  runStatus: 'completed' | 'awaiting-confirmation' = 'completed'
): string {
  return renderToStaticMarkup(
    createElement(
      ConversationLocalizationProvider,
      { value: { locale: 'zh-CN', t: (key: string) => key } },
      createElement(
        ConversationRenderSlotsProvider,
        { slots },
        createElement(
          ConversationBlockHooksProvider,
          { value: emptyConversationBlockHooks },
          createElement(MessageBubble, {
            message: { id: 'assistant', role: 'assistant', blocks, timestamp: 1 },
            sessionId: 'session',
            isStreaming: running,
            runMarker: running
              ? null
              : {
                  messageId: 'assistant',
                  status: runStatus,
                  detail: null,
                  turnCount: 1,
                  turnKind: 'turn',
                  timestamp: 2,
                },
            activityLeadingElement: unanchored
              ? createElement('aside', null, '历史子 Agent 标记')
              : null,
            renderAfterStep: () => createElement('aside', null, '子 Agent 卡标记'),
          })
        )
      )
    ) as ReactElement
  )
}

void describe('processed conversation cards', () => {
  void test('one completed disclosure contains approvals and script-attached sub-agents', () => {
    const markup = render([script, approval, summary])
    assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
    assert.doesNotMatch(markup, /批准命令标记|子 Agent 卡标记/u)
    assert.match(markup, /最终回答标记/u)
  })

  void test('completed activity folds even when there is no final text', () => {
    const markup = render([script, approval])
    assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
    assert.doesNotMatch(markup, /批准命令标记|子 Agent 卡标记/u)
  })

  void test('historical sub-agents without a step anchor join the same completed disclosure', () => {
    const markup = render([script, approval, summary], false, true)
    assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
    assert.doesNotMatch(markup, /历史子 Agent 标记|子 Agent 卡标记/u)
    assert.match(markup, /最终回答标记/u)
  })

  void test('settled approval updates after the final text still join processed activity', () => {
    for (const status of ['answered', 'declined', 'expired'] as const) {
      const markup = render([script, summary, { ...approval, status }])
      assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
      assert.doesNotMatch(markup, /批准命令标记|子 Agent 卡标记/u)
      assert.match(markup, /最终回答标记/u)
    }
  })

  void test('live sub-agents and pending approval cards remain available while execution runs', () => {
    const markup = render(
      [
        { ...script, status: 'running' },
        { ...approval, status: 'pending', answer: undefined },
      ],
      true
    )
    assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
    assert.doesNotMatch(markup, /data-slot="script-execution"/u)
    assert.match(markup, /aria-expanded="false"/u)
    assert.match(markup, /子 Agent 卡标记/u)
    assert.match(markup, /批准命令标记/u)
  })

  void test('waiting for user approval keeps the card available without a processed disclosure', () => {
    const markup = render(
      [
        { ...script, status: 'running' },
        { ...approval, status: 'pending', answer: undefined },
      ],
      false,
      false,
      'awaiting-confirmation'
    )
    assert.equal(markup.match(/data-slot="tool-activity-disclosure"/gu)?.length, 1)
    assert.doesNotMatch(markup, /data-slot="script-execution"/u)
    assert.match(markup, /aria-expanded="false"/u)
    assert.match(markup, /批准命令标记/u)
    assert.match(markup, /子 Agent 卡标记/u)
  })
})
