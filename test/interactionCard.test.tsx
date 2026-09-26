import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  buildMessageRenderSegments,
  type ConversationMessageRunMarker,
  partitionProcessedActivitySummarySegments,
  settledRunMarker,
} from '../src/conversation/blocks/messageBubbleRenderModel'
import { MessageContentBlock } from '../src/conversation/blocks/MessageContentBlock'
import {
  canSendAskUserDrafts,
  isAskUserDraftAnswered,
} from '../src/conversation/cards/AskUserCarousel'
import { InteractionAnswerProvider } from '../src/conversation/cards/interactionAnswerContext'
import { InteractionCard } from '../src/conversation/cards/InteractionCard'
import {
  buildInteractionAnswer,
  buildInteractionDrafts,
  buildInteractionQuestions,
  describeInteractionOutcome,
  resolveInteractionTitle,
  resolveInteractionTone,
  splitInteractionMessage,
} from '../src/conversation/cards/interactionPresentation'
import type { ContentBlock, InteractionBlock } from '../src/conversation/contracts'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
  conversationZhCNMessages,
} from '../src/conversation/i18n'
import { buildToolRenderSegments } from '../src/conversation/tool-render/toolCallRenderGrouping'

function lookupMessage(key: string): string {
  let node: unknown = conversationZhCNMessages
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  return typeof node === 'string' ? node : key
}

const i18n: ConversationI18nContextValue = {
  locale: 'zh-CN',
  setLocale: async () => undefined,
  t: (key, params) =>
    lookupMessage(key).replaceAll(/\{(\w+)\}/gu, (placeholder, name: string) =>
      String(params?.[name] ?? placeholder)
    ),
}
const t = i18n.t

function render(node: ReactElement, answering = true): string {
  const content = answering
    ? createElement(InteractionAnswerProvider, { value: () => undefined }, node)
    : node
  return renderToStaticMarkup(
    createElement(ConversationLocalizationProvider, { value: i18n }, content)
  )
}

const choice: InteractionBlock = {
  type: 'interaction',
  id: 'ask-1',
  kind: 'choice',
  message: '改动先应用到哪个环境？\n预发环境没人在用。',
  options: [
    { id: 'staging', label: '预发环境', recommended: true },
    { id: 'production', label: '生产环境', description: '直接上线' },
  ],
  allowText: true,
  status: 'pending',
}

const form: InteractionBlock = {
  type: 'interaction',
  id: 'ask-2',
  kind: 'form',
  message: '请填写发布信息。',
  fields: [
    { id: 'version', label: '版本号', kind: 'text', required: true },
    { id: 'count', label: '实例数', kind: 'number' },
    { id: 'notify', label: '通知团队', kind: 'boolean' },
    {
      id: 'regions',
      label: '地区',
      kind: 'choice',
      multiple: true,
      options: [
        { id: 'cn', label: '国内' },
        { id: 'us', label: '美国' },
      ],
    },
  ],
  status: 'pending',
}

const danger: InteractionBlock = {
  type: 'interaction',
  id: 'confirm-1',
  kind: 'danger',
  message: '这条命令会删除目录，确认执行？\n删掉后要重新构建。',
  operation: { label: 'rm -rf build', target: '/tmp/project' },
  status: 'pending',
}

void describe('interaction presentation', () => {
  void test('the first line is the title and the rest keeps its line breaks', () => {
    assert.deepEqual(splitInteractionMessage('\n  标题  \n第二行\n\n第三行\n'), {
      title: '标题',
      rest: '第二行\n\n第三行',
    })
    assert.equal(resolveInteractionTitle({ kind: 'login', message: '  ' }, t), '需要登录')
  })

  void test('a choice is one question; every form field is one, with yes/no for booleans', () => {
    const [question] = buildInteractionQuestions(choice, t)
    assert.equal(question?.label, choice.message)
    assert.equal(question?.required, true)
    assert.equal(question?.allowText, true)
    assert.deepEqual(
      buildInteractionQuestions(form, t).map((item) => [
        item.id,
        item.options?.map((option) => option.label) ?? null,
        !!item.numeric,
        !!item.required,
      ]),
      [
        ['version', null, false, true],
        ['count', null, true, false],
        ['notify', ['是', '否'], false, false],
        ['regions', ['国内', '美国'], false, false],
      ]
    )
  })

  void test('drafts become the answer each request expects and come back for review', () => {
    assert.deepEqual(
      buildInteractionAnswer(choice, { choice: { choices: ['staging'], text: '  先试一下 ' } }),
      { choices: ['staging'], text: '先试一下' }
    )
    const drafts = {
      version: { choices: [], text: ' v2 ' },
      count: { choices: [], text: 'abc' },
      notify: { choices: ['false'], text: '' },
      regions: { choices: ['cn', 'us'], text: '' },
    }
    const answer = buildInteractionAnswer(form, drafts)
    assert.deepEqual(answer, { values: { version: 'v2', notify: false, regions: ['cn', 'us'] } })
    assert.deepEqual(buildInteractionDrafts({ ...form, answer }), {
      version: { choices: [], text: 'v2' },
      notify: { choices: ['false'], text: '' },
      regions: { choices: ['cn', 'us'], text: '' },
    })
    assert.equal(canSendAskUserDrafts(buildInteractionQuestions(form, t), {}), false)
    assert.equal(
      canSendAskUserDrafts(buildInteractionQuestions(form, t), { version: drafts.version }),
      true
    )
    assert.equal(isAskUserDraftAnswered({ choices: [], text: '   ' }), false)
  })

  void test('the collapsed line says what was answered, rejected with its reason, or expired', () => {
    assert.equal(
      describeInteractionOutcome(
        { ...choice, status: 'answered', answer: { choices: ['staging', 'production'], text: '都要' } },
        t
      ),
      '预发环境、生产环境、都要'
    )
    assert.equal(
      describeInteractionOutcome(
        { ...form, status: 'answered', answer: { values: { version: 'v2', notify: true } } },
        t
      ),
      '版本号 v2、通知团队 是'
    )
    assert.equal(
      describeInteractionOutcome({ ...danger, status: 'answered', answer: { approved: true } }, t),
      '已批准'
    )
    assert.equal(
      describeInteractionOutcome(
        { ...danger, status: 'declined', answer: { declined: true, reason: '别删' } },
        t
      ),
      '已拒绝：别删'
    )
    assert.equal(
      describeInteractionOutcome({ ...choice, status: 'declined', answer: { declined: true } }, t),
      '已跳过'
    )
    assert.equal(
      describeInteractionOutcome({ ...danger, kind: 'login', status: 'answered' }, t),
      '已继续'
    )
    assert.equal(describeInteractionOutcome({ ...form, status: 'expired' }, t), '已失效')
    assert.deepEqual(
      (['pending', 'answered', 'declined', 'expired'] as const).map(resolveInteractionTone),
      ['waiting', 'success', 'error', 'cancelled']
    )
  })
})

void describe('interaction card', () => {
  void test('a pending choice is the carousel with lettered options, skip and send', () => {
    const html = render(createElement(InteractionCard, { block: choice }))
    assert.match(html, /data-slot="interaction"/)
    assert.match(html, /data-status="pending"/)
    assert.match(html, /预发环境没人在用/)
    assert.match(html, />A<.*预发环境.*推荐/s)
    assert.match(html, />B<.*生产环境.*直接上线/s)
    assert.match(html, /placeholder="其他（可选）"/)
    assert.match(html, />跳过</)
    assert.match(html, />发送</)
    assert.doesNotMatch(html, /问题 1/)
  })

  void test('a pending form pages through its fields after the intro', () => {
    const html = render(createElement(InteractionCard, { block: form }))
    assert.match(html, /请填写发布信息/)
    assert.match(html, /问题 1 \/ 4/)
    assert.match(html, /版本号.*必填/s)
    assert.match(html, />下一个</)
  })

  void test('a pending risky command is one title line with reject and approve; the rest waits for the look-back', () => {
    const html = render(createElement(InteractionCard, { block: danger }))
    assert.match(html, /data-tone="waiting"/)
    assert.match(html, /这条命令会删除目录，确认执行？/)
    assert.doesNotMatch(html, /删掉后要重新构建/)
    assert.doesNotMatch(html, /<code[^>]*>rm -rf build<\/code>/)
    assert.doesNotMatch(html, /在 \/tmp\/project 里运行/)
    assert.match(html, />拒绝</)
    assert.match(html, />批准</)
  })

  void test('the sign-in wall continues or cancels; a plain question takes a written answer', () => {
    const login = render(
      createElement(InteractionCard, {
        block: { ...danger, kind: 'login', message: '请在页面里登录。', operation: undefined },
      })
    )
    assert.match(login, />取消</)
    assert.match(login, />继续</)
    const input = render(
      createElement(InteractionCard, {
        block: { type: 'interaction', id: 'ask-3', kind: 'input', message: '文件在哪？', status: 'pending' },
      })
    )
    assert.match(input, /<textarea/)
    assert.match(input, /placeholder="写下你的回答，回车发送"/)
  })

  void test('a capability request is its message with an answer box, never a JSON payload', () => {
    const capability = render(
      createElement(InteractionCard, {
        block: {
          type: 'interaction',
          id: 'cap-1',
          kind: 'capability',
          message: '需要挂载 velaros:files 模块',
          status: 'pending',
        },
      })
    )
    assert.match(capability, /需要挂载 velaros:files 模块/)
    assert.match(capability, /<textarea/)
    assert.doesNotMatch(capability, /<pre/)
  })

  void test('the tail of the text only marks settled runs: waiting for an answer draws no pause mark', () => {
    const marker = (status: ConversationMessageRunMarker['status']): ConversationMessageRunMarker => ({
      messageId: 'm',
      status,
      detail: null,
      turnCount: null,
      turnKind: null,
      timestamp: 1,
    })
    assert.equal(settledRunMarker(marker('awaiting-input')), null)
    assert.equal(settledRunMarker(marker('awaiting-confirmation')), null)
    assert.equal(settledRunMarker(undefined), null)
    for (const status of ['completed', 'failed', 'aborted'] as const)
      assert.equal(settledRunMarker(marker(status))?.status, status)
  })

  void test('without an answer channel, and once answered, the card is one collapsed line', () => {
    const readOnly = render(createElement(InteractionCard, { block: danger }), false)
    assert.match(readOnly, /aria-expanded="false"/)
    assert.match(readOnly, /等你回答/)
    assert.doesNotMatch(readOnly, />批准</)
    const answered = render(
      createElement(InteractionCard, {
        block: { ...choice, status: 'answered', answer: { choices: ['staging'] } },
      })
    )
    assert.match(answered, /data-tone="success"/)
    assert.match(answered, /改动先应用到哪个环境？/)
    assert.match(answered, /预发环境/)
    assert.doesNotMatch(answered, />发送</)
  })

  void test('message blocks render interaction cards', () => {
    const html = render(
      createElement(MessageContentBlock, {
        block: danger,
        isStreaming: false,
        animateStreamingText: false,
        sessionId: 's',
        messageId: 'm',
      })
    )
    assert.match(html, /data-slot="interaction"/)
  })
})

void describe('processed activity', () => {
  void test('interaction cards and widgets stay outside the collapsed processed group', () => {
    const blocks: ContentBlock[] = [
      { type: 'thinking', text: '想一想' },
      { ...danger, status: 'answered', answer: { approved: true } },
      { type: 'widget', id: 'w', title: '图', code: '<svg></svg>', height: 200 },
      { type: 'text', text: '好了。' },
    ]
    const segments = buildMessageRenderSegments(buildToolRenderSegments(blocks))
    const partition = partitionProcessedActivitySummarySegments(segments, 3)
    const types = (list: typeof segments): string[] =>
      list.map((segment) => (segment.kind === 'segment' ? segment.segment.block.type : 'group'))
    assert.deepEqual(types(partition.processedSegments), ['thinking'])
    assert.deepEqual(types(partition.outsideSegments), ['interaction', 'widget'])
    assert.deepEqual(types(partition.trailingSegments), ['text'])
  })
})
