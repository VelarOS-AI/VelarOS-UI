import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  type ConversationBlockHooks,
  ConversationBlockHooksProvider,
} from '../../packages/ui/src/conversation/blocks/conversationBlockHooks'
import { MessageBubble } from '../../packages/ui/src/conversation/blocks/MessageBubble'
import { buildMessageRenderSegments } from '../../packages/ui/src/conversation/blocks/messageBubbleRenderModel'
import { MessageContentBlock } from '../../packages/ui/src/conversation/blocks/MessageContentBlock'
import { ToolActivityDisclosure } from '../../packages/ui/src/conversation/blocks/MessageToolActivity'
import {
  formatScriptModuleLabel,
  formatScriptPayload,
  formatToolCallPayload,
  isLongExecutionPayload,
  readToolCallErrorText,
  resolveScriptExecutionFailureReason,
  resolveScriptExecutionTitle,
  resolveScriptExecutionTone,
  resolveToolCallStepTone,
} from '../../packages/ui/src/conversation/cards/executionStepPresentation'
import {
  ScriptExecutionCard,
  ScriptExecutionDetails,
  ScriptSourcePreview,
} from '../../packages/ui/src/conversation/cards/ScriptExecutionCard'
import { ToolCallStepCard } from '../../packages/ui/src/conversation/cards/ToolCallStepCard'
import type {
  ChatMessage,
  ContentBlock,
  ScriptExecutionBlock,
  ScriptExecutionCall,
  ToolCallBlock,
} from '../../packages/ui/src/conversation/contracts'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
  conversationZhCNMessages,
} from '../../packages/ui/src/conversation/i18n'
import { buildToolRenderSegments } from '../../packages/ui/src/conversation/tool-render/toolCallRenderGrouping'

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

const blockHooks: ConversationBlockHooks = {
  useAutoTranslateThinkingEnabled: () => false,
  useMessageActionView: () => ({
    actionItems: [],
    actionRows: [],
    formatPathForDisplay: (path) => path,
    hasActionItems: false,
    openPathInLight: async () => undefined,
  }),
}

function render(node: ReactElement): string {
  return renderToStaticMarkup(
    createElement(
      ConversationLocalizationProvider,
      { value: i18n },
      createElement(ConversationBlockHooksProvider, { value: blockHooks }, node)
    )
  )
}

function call(overrides: Partial<ScriptExecutionCall> = {}): ScriptExecutionCall {
  return {
    module: 'velaros:shell',
    operation: 'run',
    status: 'succeeded',
    effect: 'none',
    input: JSON.stringify({ command: 'bun run build' }),
    output: JSON.stringify({ exitCode: 0 }),
    inputTruncated: false,
    outputTruncated: false,
    ...overrides,
  }
}

function script(overrides: Partial<ScriptExecutionBlock> = {}): ScriptExecutionBlock {
  return {
    type: 'script-execution',
    id: 'script-1',
    title: '读取配置并构建',
    status: 'succeeded',
    source: "const result = await shell.run({ command: 'bun run build' })",
    sourceTruncated: false,
    modules: ['velaros:project', 'velaros:shell'],
    calls: [call()],
    ...overrides,
  }
}

function toolCall(toolCallId: string, toolName: string, extra: Partial<ToolCallBlock> = {}): ToolCallBlock {
  return {
    type: 'tool-call',
    toolCallId,
    toolName,
    args: { path: 'src/a.ts' },
    result: { ok: true },
    isRunning: false,
    ...extra,
  }
}

function countMatches(markup: string, pattern: RegExp): number {
  return [...markup.matchAll(pattern)].length
}

void describe('脚本执行卡的呈现判定', () => {
  void test('模块标签去掉冒号前的前缀，没有前缀时原样', () => {
    assert.equal(formatScriptModuleLabel('velaros:shell'), 'shell')
    assert.equal(formatScriptModuleLabel('mcp:github'), 'github')
    assert.equal(formatScriptModuleLabel('workspace'), 'workspace')
    assert.equal(formatScriptModuleLabel('velaros:'), 'velaros:')
  })

  void test('标题优先用宿主那句话，空时按第一处调用的「模块 · 操作」，再没有就交给卡片兜底', () => {
    assert.equal(resolveScriptExecutionTitle(script({ title: '  读取配置  ' })), '读取配置')
    assert.equal(
      resolveScriptExecutionTitle(script({ title: '', calls: [call({ module: 'velaros:project', operation: 'edit' })] })),
      'project · edit'
    )
    assert.equal(resolveScriptExecutionTitle(script({ title: ' ', calls: [] })), null)
  })

  void test('只有失败且带原因时才给标题下那行，取第一处非空行', () => {
    assert.equal(
      resolveScriptExecutionFailureReason({ status: 'failed', error: '\nTypeError: boom\n    at script:3:1' }),
      'TypeError: boom'
    )
    assert.equal(resolveScriptExecutionFailureReason({ status: 'failed' }), null)
    assert.equal(resolveScriptExecutionFailureReason({ status: 'succeeded', error: 'ignored' }), null)
  })

  void test('编写中与运行中都是进行中的外观', () => {
    assert.equal(resolveScriptExecutionTone('writing'), 'running')
    assert.equal(resolveScriptExecutionTone('running'), 'running')
    assert.equal(resolveScriptExecutionTone('succeeded'), 'success')
    assert.equal(resolveScriptExecutionTone('failed'), 'error')
    assert.equal(resolveScriptExecutionTone('cancelled'), 'cancelled')
  })

  void test('参数与返回按 JSON 排版，多行字符串照原样断行，解析不了的原文照旧', () => {
    assert.equal(
      formatScriptPayload(JSON.stringify({ exitCode: 0, stdout: 'line 1\nline "2"' })),
      '{\n  "exitCode": 0,\n  "stdout": "line 1\nline \\"2\\""\n}'
    )
    assert.equal(formatScriptPayload(JSON.stringify('file\ncontent')), 'file\ncontent')
    assert.equal(formatScriptPayload(JSON.stringify({ list: [], empty: {} })), '{\n  "list": [],\n  "empty": {}\n}')
    assert.equal(formatScriptPayload('{"truncated": "abc'), '{"truncated": "abc')
    assert.equal(formatScriptPayload('   '), '')
  })

  void test('长参数按行数或字符数折起来', () => {
    assert.equal(isLongExecutionPayload('a\nb\nc'), false)
    assert.equal(isLongExecutionPayload(Array.from({ length: 9 }, () => 'x').join('\n')), true)
    assert.equal(isLongExecutionPayload('x'.repeat(601)), true)
  })

  void test('旧工具调用：错误认 { message }，空参数不出段，坏数据只降级不抛错', () => {
    assert.equal(readToolCallErrorText({ error: { message: ' boom ' } as unknown as string }), 'boom')
    assert.equal(resolveToolCallStepTone({ isRunning: true, error: 'x' }), 'running')
    assert.equal(resolveToolCallStepTone({ isRunning: false, error: ' ' }), 'success')
    assert.equal(resolveToolCallStepTone({ isRunning: false, error: 'failed' }), 'error')
    assert.equal(formatToolCallPayload({}), null)
    assert.equal(formatToolCallPayload(null), null)

    const circular: Record<string, unknown> = {}
    circular.self = circular
    assert.equal(formatToolCallPayload(circular)?.text, '[object Object]')
    assert.deepEqual(formatToolCallPayload('x'.repeat(8_001)), { text: 'x'.repeat(8_000), truncated: true })
  })
})

void describe('ScriptExecutionCard', () => {
  void test('收起时一行：状态读屏名、标题、模块标签、「+N」；详情不渲染', () => {
    const markup = render(
      createElement(ScriptExecutionCard, {
        block: script({
          modules: ['velaros:project', 'velaros:shell', 'mcp:github', 'velaros:web', 'velaros:office'],
        }),
      })
    )

    assert.match(markup, /data-slot="script-execution"/)
    assert.match(markup, /aria-expanded="false"/)
    assert.match(markup, /role="img" aria-label="已完成"/)
    assert.match(markup, />读取配置并构建</)
    assert.match(markup, />project<\/span><span[^>]*>shell<\/span><span[^>]*>github<\/span>/)
    assert.match(markup, /aria-label="另有 2 个模块"[^>]*>\+2</)
    assert.doesNotMatch(markup, />velaros:web</)
    assert.doesNotMatch(markup, /参数/)
  })

  void test('失败且有原因时标题下一行露出第一行原因', () => {
    const markup = render(
      createElement(ScriptExecutionCard, {
        block: script({ status: 'failed', error: 'TypeError: exitCode of undefined\n    at script:2:1' }),
      })
    )

    assert.match(markup, /data-tone="error"/)
    assert.match(markup, /aria-label="失败"/)
    assert.match(markup, />TypeError: exitCode of undefined</)
    assert.doesNotMatch(markup, /at script:2:1/)
  })

  void test('标题为空时按第一处调用兜底，没有调用时显示「执行脚本」', () => {
    assert.match(
      render(createElement(ScriptExecutionCard, { block: script({ title: '', calls: [call()] }) })),
      />shell · run</
    )
    assert.match(
      render(
        createElement(ScriptExecutionCard, {
          block: script({ title: '', status: 'writing', source: '', modules: [], calls: [] }),
        })
      ),
      /aria-label="编写中"[\s\S]*>执行脚本</
    )
  })

  void test('详情按顺序列出每次调用的模块 · 操作、状态、外部效果、参数与返回，失败的返回标成错误', () => {
    const markup = render(
      createElement(ScriptExecutionDetails, {
        block: script({
          calls: [
            call({ module: 'velaros:project', operation: 'edit', effect: 'committed', inputTruncated: true }),
            call({
              status: 'failed',
              effect: 'partial',
              output: JSON.stringify({ message: 'exit 2' }),
            }),
          ],
          error: 'TypeError: boom',
        }),
      })
    )

    assert.ok(markup.indexOf('velaros:project · edit') < markup.indexOf('velaros:shell · run'))
    assert.match(markup, />成功 · 已生效</)
    assert.match(markup, />失败 · 部分生效</)
    assert.equal(countMatches(markup, />参数</gu), 2)
    assert.equal(countMatches(markup, />返回</gu), 1)
    assert.equal(countMatches(markup, />错误</gu), 1)
    assert.match(markup, /&quot;command&quot;: &quot;bun run build&quot;/)
    assert.equal(countMatches(markup, />内容过长，已截断</gu), 1)
    assert.match(markup, />脚本出错<[\s\S]*>TypeError: boom</)
  })

  void test('没有调用也没有错误时说明这一步没调用能力', () => {
    assert.match(
      render(createElement(ScriptExecutionDetails, { block: script({ calls: [] }) })),
      />这一步没有调用能力模块。</
    )
  })

  void test('悬停气泡：有源码时等宽原样给出，截断时末尾标注；编写中还没源码时说正在编写', () => {
    const withSource = render(
      createElement(ScriptSourcePreview, {
        block: { source: 'const a = 1\n  return a', sourceTruncated: true, status: 'running' },
      })
    )
    assert.match(withSource, /data-slot="script-execution-source"/)
    assert.match(withSource, /<pre[^>]*><code>const a = 1\n {2}return a<\/code><\/pre>/)
    assert.match(withSource, />源码过长，后面的部分已截断。</)

    assert.match(
      render(createElement(ScriptSourcePreview, { block: { source: '', sourceTruncated: false, status: 'writing' } })),
      />正在编写…</
    )
    assert.match(
      render(createElement(ScriptSourcePreview, { block: { source: ' ', sourceTruncated: false, status: 'cancelled' } })),
      />没有源码。</
    )
  })
})

void describe('旧工具调用的通用卡', () => {
  void test('只有工具名、状态与耗时一行，失败时标题下露出错误，不按工具分类换图标或换卡', () => {
    const markup = render(
      createElement(ToolCallStepCard, {
        block: toolCall('run-1', 'project:run', {
          args: { command: 'bun run build' },
          result: undefined,
          error: "error TS2307: Cannot find module './env'\nmore",
          startedAt: 1_000,
          finishedAt: 5_000,
        }),
      })
    )

    assert.match(markup, /data-slot="tool-call-step"/)
    assert.match(markup, />project:run</)
    assert.match(markup, /aria-label="失败"/)
    assert.match(markup, />4秒</)
    assert.match(markup, />error TS2307: Cannot find module &#x27;\.\/env&#x27;</)
    assert.match(markup, /aria-expanded="false"/)
  })

  void test('宿主给了标题时标题在前、工具名作标签', () => {
    const markup = render(
      createElement(ToolCallStepCard, { block: toolCall('read-1', 'project:read', { title: '读取配置' }) })
    )

    assert.match(markup, />读取配置<\/span>[\s\S]*>project:read</)
  })
})

void describe('脚本执行块的分发', () => {
  void test('script-execution 块直接渲染成脚本卡，不经工具活动折叠', () => {
    const markup = render(
      createElement(MessageContentBlock, {
        block: script(),
        isStreaming: false,
        animateStreamingText: false,
        sessionId: 'session',
        messageId: 'message',
      })
    )

    assert.match(markup, /data-slot="script-execution"/)
    assert.match(markup, /data-tool-activity-motion="none"/)
    assert.doesNotMatch(markup, /data-slot="tool-activity-disclosure"/)
  })

  void test('脚本卡各自成段、按身份取 key；旧工具调用一次一段、按发生顺序进同一个活动组', () => {
    const blocks: ContentBlock[] = [
      { type: 'thinking', text: '先看看。' },
      script({ id: 'a' }),
      script({ id: 'b' }),
      toolCall('read-1', 'project:read'),
      toolCall('run-1', 'project:run'),
      toolCall('read-2', 'project:read'),
      { type: 'text', text: '好了。' },
    ]
    const segments = buildMessageRenderSegments(buildToolRenderSegments(blocks))

    assert.deepEqual(
      segments.map((segment) => (segment.kind === 'activity-group' ? segment.segments.map((child) => child.key) : segment.key)),
      ['thinking:0', 'script:a', 'script:b', ['tool:read-1', 'tool:run-1', 'tool:read-2'], 'text:6']
    )
  })

  void test('消息里的脚本卡纵向平铺在活动折叠外，折叠只数旧工具调用的次数', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      timestamp: 1,
      blocks: [
        script({ id: 'a', title: '第一步' }),
        script({ id: 'b', title: '第二步' }),
        toolCall('read-1', 'project:read'),
        toolCall('run-1', 'project:run'),
        { type: 'text', text: '收尾。' },
      ],
    }
    const markup = render(createElement(MessageBubble, { message, sessionId: 'session' }))

    assert.equal(countMatches(markup, /data-slot="script-execution"/gu), 2)
    assert.ok(markup.indexOf('第一步') < markup.indexOf('第二步'))
    assert.match(markup, /data-slot="tool-activity-disclosure"[\s\S]*>调用了 2 次工具</)
    assert.doesNotMatch(markup, /已探索|运行 \d+ 条命令/u)
    // 折叠收着：旧工具调用的卡不在标记里，脚本卡却在，说明脚本卡不在折叠里面。
    assert.doesNotMatch(markup, /data-slot="tool-call-step"/)
  })

  void test('旧工具调用的折叠标题只数次数，不再按分类拼「已编辑 / 已探索」', () => {
    const markup = render(
      createElement(ToolActivityDisclosure, {
        blocks: [toolCall('read-1', 'project:read'), toolCall('edit-1', 'project:edit'), toolCall('run-1', 'project:run')],
        children: null,
      })
    )

    assert.match(markup, />调用了 3 次工具</)
    assert.doesNotMatch(markup, /已编辑|已探索|条命令/u)
  })
})
