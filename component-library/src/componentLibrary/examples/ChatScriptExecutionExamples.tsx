import type { ComponentProps, ReactElement } from 'react'

import { MessageBubble, ScriptExecutionCard } from '@velaros-ai/ui/conversation'
import type { ScriptExecutionBlock } from '@velaros-ai/ui/conversation/contracts'
import { Stack } from '@velaros-ai/ui/primitives/layout/Stack'

type ChatMessage = ComponentProps<typeof MessageBubble>['message']

const SESSION_ID = 'component-library-session'
const FixtureTimestamp = new Date('2026-09-25T10:30:00+08:00').getTime()

const typecheckSource = `const result = await shell.run({ command: 'bun run typecheck' })
if (result.exitCode !== 0) return { ok: false, errors: result.stderr.split('\\n').slice(0, 20) }
return { ok: true }`

const buildConfigSource = `const manifest = JSON.parse(await project.read({ path: 'package.json' }))
const scripts = Object.keys(manifest.scripts ?? {})

// 构建脚本在，就真跑一遍确认能过。
if (!scripts.includes('build')) return { scripts, build: null }
const build = await shell.run({ command: 'bun run build', timeoutMs: 120_000 })
return { scripts, build: { exitCode: build.exitCode, tail: build.stdout.split('\\n').slice(-5) } }`

const writingBlock: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'script-writing',
  title: '',
  status: 'writing',
  source: '',
  sourceTruncated: false,
  modules: [],
  calls: [],
}

const runningBlock: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'script-running',
  title: '运行类型检查并收集报错',
  status: 'running',
  source: typecheckSource,
  sourceTruncated: false,
  modules: ['velaros:shell'],
  calls: [
    {
      module: 'velaros:shell',
      operation: 'run',
      status: 'pending',
      effect: 'unknown',
      input: JSON.stringify({ command: 'bun run typecheck' }),
      output: '',
      inputTruncated: false,
      outputTruncated: false,
    },
  ],
}

const succeededBlock: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'script-succeeded',
  title: '读取项目配置并确认构建脚本能跑通',
  status: 'succeeded',
  source: buildConfigSource,
  sourceTruncated: false,
  modules: ['velaros:project', 'velaros:shell'],
  calls: [
    {
      module: 'velaros:project',
      operation: 'read',
      status: 'succeeded',
      effect: 'none',
      input: JSON.stringify({ path: 'package.json' }),
      output: JSON.stringify(
        JSON.stringify(
          { name: 'demo-app', scripts: { build: 'vite build', dev: 'vite', test: 'bun test' } },
          null,
          2
        )
      ),
      inputTruncated: false,
      outputTruncated: false,
    },
    {
      module: 'velaros:shell',
      operation: 'run',
      status: 'succeeded',
      effect: 'none',
      input: JSON.stringify({ command: 'bun run build', timeoutMs: 120_000 }),
      output: JSON.stringify({
        exitCode: 0,
        stdout: Array.from({ length: 40 }, (_, index) => `✓ transformed chunk ${index + 1}`).join('\n'),
        durationMs: 4_218,
      }),
      inputTruncated: false,
      outputTruncated: true,
    },
  ],
}

const failedBlock: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'script-failed',
  title: '更新接口地址后重新构建',
  status: 'failed',
  source: `await project.edit({ path: 'src/config.ts', find: 'api.dev', replace: 'api.internal' })
const build = await shell.run({ command: 'bun run build' })
return build.result.exitCode`,
  sourceTruncated: false,
  modules: ['velaros:project', 'velaros:shell', 'mcp:github', 'velaros:web'],
  calls: [
    {
      module: 'velaros:project',
      operation: 'edit',
      status: 'succeeded',
      effect: 'committed',
      input: JSON.stringify({ path: 'src/config.ts', find: 'api.dev', replace: 'api.internal' }),
      output: JSON.stringify({ changed: true, path: 'src/config.ts' }),
      inputTruncated: false,
      outputTruncated: false,
    },
    {
      module: 'velaros:shell',
      operation: 'run',
      status: 'failed',
      effect: 'partial',
      input: JSON.stringify({ command: 'bun run build' }),
      output: JSON.stringify({ message: 'error TS2307: Cannot find module \'./env\'', exitCode: 2 }),
      inputTruncated: false,
      outputTruncated: false,
    },
  ],
  error: "TypeError: Cannot read properties of undefined (reading 'exitCode')\n    at script:3:21",
}

const cancelledBlock: ScriptExecutionBlock = {
  type: 'script-execution',
  id: 'script-cancelled',
  title: '',
  status: 'cancelled',
  source: `await shell.run({ command: 'bun run dev' })`,
  sourceTruncated: false,
  modules: ['velaros:shell'],
  calls: [
    {
      module: 'velaros:shell',
      operation: 'run',
      status: 'cancelled',
      effect: 'unknown',
      input: JSON.stringify({ command: 'bun run dev' }),
      output: '',
      inputTruncated: false,
      outputTruncated: false,
    },
  ],
}

/** 脚本执行卡的几种状态：编写中 / 运行中 / 成功 / 失败（标题下露出原因）/ 已取消（标题按首个调用兜底）。 */
export function ScriptExecutionCardStatesExample(): ReactElement {
  return (
    <Stack gap="sm">
      {[writingBlock, runningBlock, succeededBlock, failedBlock, cancelledBlock].map((block) => (
        <ScriptExecutionCard key={block.id} block={block} />
      ))}
    </Stack>
  )
}

const runningAssistantMessage: ChatMessage = {
  id: 'library-script-running',
  role: 'assistant',
  timestamp: FixtureTimestamp,
  blocks: [
    { type: 'thinking', text: '先确认构建脚本存在，再跑一遍类型检查。' },
    succeededBlock,
    runningBlock,
  ],
}

const legacyToolCallMessage: ChatMessage = {
  id: 'library-legacy-tool-calls',
  role: 'assistant',
  timestamp: FixtureTimestamp + 60_000,
  blocks: [
    {
      type: 'tool-call',
      toolCallId: 'legacy-read',
      toolName: 'project:read',
      args: { path: 'src/config.ts' },
      result: { path: 'src/config.ts', content: "export const apiHost = 'api.internal'" },
      startedAt: FixtureTimestamp + 1_000,
      finishedAt: FixtureTimestamp + 1_240,
    },
    {
      type: 'tool-call',
      toolCallId: 'legacy-run',
      toolName: 'project:run',
      args: { command: 'bun run build' },
      error: "error TS2307: Cannot find module './env'",
      startedAt: FixtureTimestamp + 2_000,
      finishedAt: FixtureTimestamp + 6_100,
    },
    { type: 'text', text: '旧会话里的工具调用仍收在「调用了 N 次工具」里，每一步是通用的「工具名 + 状态」卡。' },
  ],
}

/** 放进消息里：同一条消息的脚本卡直接纵向排列，不进工具活动折叠；旧会话的工具调用换成通用卡。 */
export function ScriptExecutionTranscriptExample(): ReactElement {
  return (
    <div data-library-chat-sample>
      <div data-library-chat-frame>
        <MessageBubble message={runningAssistantMessage} sessionId={SESSION_ID} isStreaming />
        <MessageBubble message={legacyToolCallMessage} sessionId={SESSION_ID} />
      </div>
    </div>
  )
}
