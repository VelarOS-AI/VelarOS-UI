import { describe, expect, test } from 'bun:test'

import type { ChatMessage, ContentBlock, ScriptExecutionBlock } from '../src/conversation/contracts'
import { conversationMessagesByLocale } from '../src/conversation/i18n/conversationMessageCatalog'
import type { ConversationTranslator } from '../src/conversation/i18n/conversationTranslator'
import type { ChatStatusRuntime } from '../src/conversation/status/chatStatus'
import { readConversationLiveActivity } from '../src/conversation/status/readConversationLiveActivity'
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
const readChatLiveActivity = (options: Parameters<typeof readConversationLiveActivity>[0]) =>
  readConversationLiveActivity(options, translator)

const runtime: ChatStatusRuntime = {
  status: 'running',
  teamPhase: 'executing',
  activeTurn: 1,
  completedTurns: 0,
  lastError: null,
  connectionRetryAttempt: null,
  connectionRetryMaxAttempts: null,
  lastRunStartedAt: 100,
  awaitingConfirmationMessage: null,
  awaitingInputQuestion: null,
}
function script(
  title: string,
  status: ScriptExecutionBlock['status'] = 'running'
): ScriptExecutionBlock {
  return {
    type: 'script-execution',
    id: title,
    kind: 'execute',
    title,
    status,
    source: '',
    sourceTruncated: false,
    calls: [],
    durationMs: null,
  }
}
function message(blocks: ContentBlock[]): ChatMessage {
  return { id: 'answer', role: 'assistant', timestamp: 101, blocks }
}
function activity(
  blocks: ContentBlock[],
  overrides: Partial<ChatStatusRuntime> = {},
  waitMessage?: string
) {
  return readChatLiveActivity({
    runtime: { ...runtime, ...overrides },
    message: message(blocks),
    locale: 'zh-CN',
    waitMessage,
  })
}

describe('current conversation activity', () => {
  test('shows the latest running script title instead of a generic phase', () => {
    expect(
      activity([script('读取入口', 'succeeded'), script('启动最终验收服务器')]).liveTraceSummary
    ).toBe('启动最终验收服务器')
    expect(activity([script('准备检查', 'writing')]).liveTraceSummary).toBe('准备检查')
    expect(activity([script('旧检查'), script('当前检查')]).liveTraceSummary).toBe('当前检查')
  })
  test('tool and script cards compete by recency, not by card type', () => {
    const tool: ContentBlock = {
      type: 'tool-call',
      toolCallId: 'tool',
      toolName: 'shell',
      args: { command: 'bun run check' },
      isRunning: true,
      title: '验证项目',
    }
    expect(activity([script('读取入口'), tool]).liveTraceSummary).toBe('验证项目')
    expect(activity([tool, script('启动服务器')]).liveTraceSummary).toBe('启动服务器')
    expect(activity([{ ...tool, isRunning: false }]).liveTraceSummary).toBe('执行中')
    expect(activity([{ ...tool, title: '  ' }]).liveTraceSummary).toContain('bun run check')
  })
  test('writing a script can replace thinking without waiting for the execution phase', () => {
    expect(
      activity([{ type: 'thinking', text: '读取入口。' }, script('开始读取入口', 'writing')], {
        teamPhase: 'researching',
      }).liveTraceSummary
    ).toBe('开始读取入口')
  })
  test('resuming clears waits, user messages and completed thinking are not live activity', () => {
    expect(activity([script('继续检查')], {}, '  ').liveTraceSummary).toBe('继续检查')
    expect(
      readChatLiveActivity({
        runtime,
        locale: 'zh-CN',
        message: { ...message([script('用户引用的脚本')]), role: 'user' },
      }).liveTraceSummary
    ).toBe('执行中')
    expect(
      activity(
        [
          { type: 'thinking', text: '检查入口。' },
          { type: 'text', text: '结论' },
        ],
        { teamPhase: 'researching' }
      ).hasStreamingThinkingBlock
    ).toBe(false)
  })
  test('finished, queued and untitled scripts fall back to the current phase', () => {
    for (const status of ['succeeded', 'failed', 'cancelled', 'queued'] as const) {
      expect(activity([script('检查服务器', status)]).liveTraceSummary).toBe('执行中')
    }
    expect(activity([script('  ')]).liveTraceSummary).toBe('执行中')
  })
  test('thinking requires the current thinking phase and a stable sentence', () => {
    const thinking: ContentBlock = {
      type: 'thinking',
      text: '### 检查项目结构\n继续分析',
    }
    expect(activity([thinking], { teamPhase: 'researching' })).toEqual({
      liveTraceSummary: '检查项目结构',
      hasStreamingThinkingBlock: true,
    })
    expect(activity([thinking])).toEqual({
      liveTraceSummary: '执行中',
      hasStreamingThinkingBlock: false,
    })
    expect(
      activity([{ type: 'thinking', text: '让我' }], {
        teamPhase: 'researching',
      }).liveTraceSummary
    ).toBe('思考中')
  })
  test('waiting and retry override activity; stopping overrides even a stale wait', () => {
    expect(activity([script('检查')], {}, '约 3 分钟后继续').liveTraceSummary).toBe(
      '约 3 分钟后继续'
    )
    expect(activity([script('检查')], { connectionRetryAttempt: 2 }).liveTraceSummary).toContain(
      '2'
    )
    expect(
      activity([script('检查')], { status: 'stopping' }, '约 3 分钟后继续').liveTraceSummary
    ).not.toBe('约 3 分钟后继续')
    expect(
      activity([script('检查')], {
        status: 'awaiting-input',
        awaitingInputQuestion: '选择工作目录',
      }).liveTraceSummary
    ).toBe('选择工作目录')
  })
  test('new phases and a new run cannot reuse stale activity', () => {
    expect(activity([script('旧检查')], { teamPhase: 'requesting-model' }).liveTraceSummary).toBe(
      '发起请求'
    )
    expect(activity([script('旧检查')], { lastRunStartedAt: 200 }).liveTraceSummary).toBe('执行中')
    expect(activity([script('旧检查')], { status: 'completed' }).liveTraceSummary).not.toBe(
      '旧检查'
    )
  })
  test('works before an assistant message exists and preserves locale fallback', () => {
    expect(
      readChatLiveActivity({
        runtime,
        locale: 'zh-CN',
        waitMessage: '等待额度恢复',
      }).liveTraceSummary
    ).toBe('等待额度恢复')
    expect(readChatLiveActivity({ runtime, locale: 'en-US' }).liveTraceSummary).toBe('Executing')
  })
})
