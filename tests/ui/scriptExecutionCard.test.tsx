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
import { HighlightedLines } from '../../packages/ui/src/conversation/cards/ExecutionStepFrame'
import {
  type HighlightedCode,
  highlightedTokenStyle,
} from '../../packages/ui/src/conversation/cards/executionStepHighlight'
import {
  formatScriptModuleLabel,
  formatScriptPayload,
  formatToolCallPayload,
  isLongExecutionPayload,
  readToolCallErrorText,
  resolveScriptExecutionFailureReason,
  resolveScriptExecutionTitle,
  resolveScriptExecutionTone,
  resolveScriptPayloadLanguage,
  resolveToolCallStepTone,
} from '../../packages/ui/src/conversation/cards/executionStepPresentation'
import {
  ScriptExecutionCard,
  ScriptExecutionDetails,
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

/** 宿主给的运行中输出：按脚本卡 id 取。 */
const liveOutputs = new Map<string, string>()

const blockHooks: ConversationBlockHooks = {
  useAutoTranslateThinkingEnabled: () => false,
  useScriptLiveOutput: (blockId) => liveOutputs.get(blockId) ?? null,
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
    kind: 'execute',
    id: 'script-1',
    title: '读取配置并构建',
    status: 'succeeded',
    source: "const result = await shell.run({ command: 'bun run build' })",
    sourceTruncated: false,
    calls: [call()],
    durationMs: 1_200,
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

/** 去掉标签后的正文：着色与否只差 span，断言正文时不看它。 */
function textOf(markup: string): string {
  return markup
    .replaceAll(/<[^>]+>/gu, '')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
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

  void test('结果排成了 JSON 对象或数组才按 JSON 着色，原文与字符串值按纯文本', () => {
    assert.equal(resolveScriptPayloadLanguage('{\n  "exitCode": 0\n}'), 'json')
    assert.equal(resolveScriptPayloadLanguage('[1, 2]'), 'json')
    assert.equal(resolveScriptPayloadLanguage('file\ncontent'), undefined)
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
  void test('收起时一行：底色表示状态、读屏文字、标题，右边是耗时；没有状态图标与模块标签，详情不渲染', () => {
    const markup = render(createElement(ScriptExecutionCard, { block: script() }))

    assert.match(markup, /data-slot="script-execution"/)
    assert.match(markup, /aria-expanded="false"/)
    assert.match(markup, /data-tone="success"/)
    assert.match(markup, />已完成</)
    assert.doesNotMatch(markup, /role="img"/)
    assert.match(markup, />读取配置并构建</)
    assert.match(markup, />1秒</)
    assert.doesNotMatch(markup, />shell</)
    assert.doesNotMatch(markup, /参数/)
  })

  void test('耗时按毫秒、秒显示；还没有结果或不到 1 毫秒时右边不写', () => {
    assert.match(render(createElement(ScriptExecutionCard, { block: script({ durationMs: 350 }) })), />350ms</)
    for (const durationMs of [null, 0.2])
      assert.doesNotMatch(
        render(createElement(ScriptExecutionCard, { block: script({ durationMs }) })),
        />\d+(ms|秒)</u
      )
  })

  void test('失败且有原因时标题下一行露出第一行原因', () => {
    const markup = render(
      createElement(ScriptExecutionCard, {
        block: script({ status: 'failed', error: 'TypeError: exitCode of undefined\n    at script:2:1' }),
      })
    )

    assert.match(markup, /data-tone="error"/)
    assert.match(markup, />失败</)
    assert.match(markup, />TypeError: exitCode of undefined</)
    assert.doesNotMatch(markup, /at script:2:1/)
  })

  void test('跑着时标题下露出正在跑的命令最后三行输出，空行不算；跑完就不再显示', () => {
    liveOutputs.set('script-1', 'resolving\n\nfetching 1/3\nfetching 2/3\nlinking   \n')
    try {
      const running = render(createElement(ScriptExecutionCard, { block: script({ status: 'running' }) }))
      assert.match(running, /data-slot="execution-step-live"/)
      assert.doesNotMatch(running, /resolving/)
      assert.match(running, /fetching 1\/3<\/span><span[^>]*>fetching 2\/3<\/span><span[^>]*>linking<\/span>/)
      const done = render(createElement(ScriptExecutionCard, { block: script({ status: 'succeeded' }) }))
      assert.doesNotMatch(done, /execution-step-live/)
    } finally {
      liveOutputs.clear()
    }
  })

  void test('标题为空时按第一处调用兜底，没有调用时显示「执行脚本」', () => {
    assert.match(
      render(createElement(ScriptExecutionCard, { block: script({ title: '', calls: [call()] }) })),
      />shell · run</
    )
    assert.match(
      render(
        createElement(ScriptExecutionCard, {
          block: script({ title: '', status: 'writing', source: '', calls: [], durationMs: null }),
        })
      ),
      />执行脚本<[\s\S]*>编写中</
    )
  })

  void test('观察卡与执行卡只靠图标区分，不写方法名；观察卡没有标题时是「持续观察」', () => {
    const iconOf = (markup: string) => /<svg[\s\S]*?<\/svg>/u.exec(markup)?.[0]
    const observed = render(
      createElement(ScriptExecutionCard, { block: script({ kind: 'observe', title: '盯着构建日志' }) })
    )
    const executed = render(createElement(ScriptExecutionCard, { block: script() }))
    assert.match(observed, />盯着构建日志</)
    assert.doesNotMatch(observed, />observe</)
    assert.ok(iconOf(observed) && iconOf(executed) && iconOf(observed) !== iconOf(executed))
    assert.match(
      render(createElement(ScriptExecutionCard, { block: script({ kind: 'observe', title: '', calls: [] }) })),
      />持续观察</
    )
  })

  void test('详情先给执行的代码，再按顺序给每次调用的结果；不列参数与调用标题行，脚本本身的错误排在最后', () => {
    const markup = render(
      createElement(ScriptExecutionDetails, {
        block: script({
          calls: [
            call({ module: 'velaros:project', operation: 'edit', output: JSON.stringify({ changed: true }) }),
            call({ status: 'pending', output: '' }),
            call({ status: 'failed', output: JSON.stringify({ message: 'exit 2' }), outputTruncated: true }),
          ],
          error: 'TypeError: boom',
        }),
      })
    )
    const text = textOf(markup)

    assert.ok(text.indexOf("shell.run({ command: 'bun run build' })") < text.indexOf('"changed": true'))
    assert.ok(text.indexOf('"changed": true') < text.indexOf('"message": "exit 2"'))
    assert.ok(text.indexOf('"message": "exit 2"') < text.indexOf('TypeError: boom'))
    assert.doesNotMatch(markup, />参数<|>返回<|velaros:project · edit|已生效/u)
    assert.doesNotMatch(markup, /command&quot;: &quot;bun run build/u)
    assert.equal(countMatches(markup, /<pre/gu), 3, '代码一段、有返回的两次调用各一段，等待中的不占位置')
    assert.equal(countMatches(markup, />内容过长，已截断</gu), 1)
  })

  void test('编写中还没有源码时详情说正在编写', () => {
    assert.match(
      render(
        createElement(ScriptExecutionDetails, {
          block: script({ status: 'writing', source: '', calls: [] }),
        })
      ),
      />正在编写…</
    )
  })
})

void describe('语法着色', () => {
  void test('浅色主题的颜色放进 --sdm-c，暗色主题的变量原样带上，底色不要', () => {
    assert.deepEqual(
      highlightedTokenStyle({
        content: 'const',
        offset: 0,
        color: '#D73A49',
        htmlStyle: { color: '#D73A49', '--shiki-dark': '#F97583', 'background-color': '#fff' },
      }),
      { '--sdm-c': '#D73A49', '--shiki-dark': '#F97583' }
    )
  })

  void test('一行一组分词，行与行之间补回换行', () => {
    const code = {
      tokens: [
        [
          { content: 'const', offset: 0, color: '#D73A49' },
          { content: ' a = 1', offset: 5, color: '#24292E' },
        ],
        [{ content: 'return a', offset: 12, color: '#24292E' }],
      ],
      fg: '#24292E',
      bg: '#fff',
      themeName: 'github-light',
    } as unknown as HighlightedCode
    const markup = renderToStaticMarkup(createElement(HighlightedLines, { code }))

    assert.equal(textOf(markup), 'const a = 1\nreturn a')
    assert.match(markup, /style="--sdm-c:#D73A49"[^>]*>const</)
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
    assert.match(markup, /data-tone="error"/)
    assert.match(markup, />失败</)
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
