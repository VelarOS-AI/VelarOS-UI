import { describe, expect, test } from 'bun:test'

import { buildMessageRenderSegments } from '../src/conversation/blocks/messageBubbleRenderModel'
import { getToolActivityDisclosureSummary } from '../src/conversation/blocks/toolActivityDisclosurePresentation'
import type { ConversationStepBlock, ScriptExecutionBlock } from '../src/conversation/contracts'
import { conversationMessagesByLocale } from '../src/conversation/i18n/conversationMessageCatalog'
import type { ConversationTranslator } from '../src/conversation/i18n/conversationTranslator'
import { buildToolRenderSegments } from '../src/conversation/tool-render/toolCallRenderGrouping'
const translator: ConversationTranslator = {
  lookupMessage: (locale, key) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (entry, part) => (entry as Record<string, unknown>)?.[part],
        conversationMessagesByLocale[locale]
      )
    return typeof value === 'string' ? value : null
  },
  translate: (locale, key, params) =>
    (translator.lookupMessage(locale, key) ?? key).replace(/\{(\w+)\}/g, (_, token: string) =>
      String(params?.[token] ?? '')
    ),
}

function script(status: ScriptExecutionBlock['status'], id = 'script'): ScriptExecutionBlock {
  return {
    type: 'script-execution',
    id,
    kind: 'execute',
    title: '验证构建',
    status,
    source: '',
    sourceTruncated: false,
    calls: [],
    durationMs: null,
  }
}
function summary(blocks: ConversationStepBlock[], locale: 'zh-CN' | 'en-US' = 'zh-CN') {
  return getToolActivityDisclosureSummary(blocks, locale, translator)
}

describe('compact activity summary', () => {
  test('writing, queued and running have distinct labels without opening cards', () => {
    for (const [status, label] of [
      ['writing', '编写中'],
      ['queued', '排队中'],
      ['running', '运行中'],
    ] as const) {
      expect(summary([script(status)])).toEqual({ label: `${label} · 验证构建`, isRunning: true })
    }
  })
  test('latest executing step wins over queued work and exposes the group size', () => {
    expect(summary([script('running'), script('queued', 'next')]).label).toBe(
      '运行中 · 验证构建 · 共 2 项操作'
    )
    expect(
      summary([
        script('running'),
        {
          type: 'tool-call',
          toolCallId: 'last',
          toolName: 'project:run',
          title: '最终验收',
          args: {},
          isRunning: true,
        },
      ]).label
    ).toContain('运行中 · 最终验收')
  })
  test('failures and cancellations remain visible alongside active work', () => {
    const blocks = [script('failed'), script('cancelled', 'cancel'), script('running', 'current')]
    expect(summary(blocks).label).toBe('1 项失败 · 1 项已取消 · 运行中 · 验证构建 · 共 3 项操作')
    expect(summary(blocks.slice(0, 2))).toEqual({
      label: '1 项失败 · 1 项已取消',
      isRunning: false,
    })
  })
  test('successful scripts and tools share a summary, without treating failed tools as successes', () => {
    const result = summary([
      script('succeeded'),
      {
        type: 'tool-call',
        toolCallId: 'bad',
        toolName: 'project:run',
        args: {},
        error: 'SECRET ERROR DETAILS',
      },
    ])
    expect(result).toEqual({ label: '1 项失败 · 已完成 1 项操作', isRunning: false })
  })
  test('a successful no-op edit still reports completion without claiming a file changed', () => {
    expect(
      summary([
        {
          type: 'tool-call',
          toolCallId: 'noop',
          toolName: 'project:edit',
          args: {},
          result: { changed: false },
        },
      ]).label
    ).toBe('已完成 1 项操作')
  })
  test('summaries follow the provider locale', () => {
    expect(summary([script('succeeded'), script('cancelled', 'cancel')], 'en-US').label).toBe(
      '1 cancelled · Completed operations: 1'
    )
  })
  test('text, interactive cards, plans and widgets split consecutive activity', () => {
    const segments = buildMessageRenderSegments(
      buildToolRenderSegments([
        script('succeeded'),
        script('running', 'second'),
        { type: 'text', text: '解释' },
        {
          type: 'tool-call',
          toolCallId: 'confirm',
          toolName: 'interaction:confirm',
          args: {},
          isRunning: true,
        },
        { type: 'tool-call', toolCallId: 'plan', toolName: 'plan:update', args: {} },
        { type: 'tool-call', toolCallId: 'widget', toolName: 'ui:show_widget', args: {} },
        script('queued', 'third'),
      ])
    )
    expect(segments.map((segment) => segment.kind)).toEqual([
      'activity-group',
      'segment',
      'segment',
      'segment',
      'segment',
      'activity-group',
    ])
    expect(segments[0].kind === 'activity-group' && segments[0].blocks.length).toBe(2)
  })
  test('appending a tool after scripts preserves the group identity', () => {
    const first = script('running')
    const before = buildMessageRenderSegments(buildToolRenderSegments([first]))
    const after = buildMessageRenderSegments(
      buildToolRenderSegments([
        first,
        { type: 'tool-call', toolCallId: 'tool', toolName: 'project:read', args: {} },
      ])
    )
    expect(after[0].key).toBe(before[0].key)
  })
})
