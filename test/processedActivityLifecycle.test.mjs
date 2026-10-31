import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const electronPath =
  process.env.VELAROS_UI_ELECTRON_PATH ||
  (existsSync(join(dirname(require.resolve('electron/package.json')), 'path.txt'))
    ? require('electron')
    : null)

void test(
  'mounted completed activity collapses without input after updates and paused frames',
  {
    timeout: 30_000,
    skip: !electronPath && 'Set VELAROS_UI_ELECTRON_PATH to reuse an installed Electron runtime',
  },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'velaros-processed-activity-'))
    let child
    let timeout
    try {
      await writeFile(
        join(directory, 'index.html'),
        `<html><body><div id="root"></div><script type="module" src="${join(root, 'test/fixtures/processedActivityLifecycle.tsx').replaceAll('\\', '/')}"></script></body></html>`
      )
      await build({
        configFile: false,
        root: directory,
        base: './',
        publicDir: false,
        logLevel: 'silent',
        resolve: { dedupe: ['react', 'react-dom'] },
        build: {
          outDir: join(directory, 'dist'),
          emptyOutDir: true,
          cssMinify: false,
        },
      })
      const environment = { ...process.env }
      delete environment.ELECTRON_RUN_AS_NODE
      child = spawn(
        electronPath,
        [join(root, 'test/fixtures/processedActivityLifecycleElectron.cjs'), directory],
        { env: environment, stdio: ['ignore', 'ignore', 'pipe'] }
      )
      let errors = ''
      child.stderr.on('data', (chunk) => {
        errors += chunk.toString()
      })
      timeout = setTimeout(() => child.kill('SIGKILL'), 30_000)
      const code = await new Promise((resolveExit, reject) => {
        child.once('error', reject)
        child.once('exit', resolveExit)
      })
      assert.equal(code, 0, errors)
      const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))
      assert.deepEqual(report.errors, [])
      for (const key of [
        'completedWithoutInteraction',
        'nextCompletionOnSameMessage',
        'resumedWithoutInteraction',
        'historicalCompletedMount',
      ]) {
        assert.equal(report[key].expanded, 'false', key)
        assert.equal(report[key].hasSummary, true, key)
      }
      for (const key of [
        'manualExpansionSurvivesUpdates',
        'beforePausedFrames',
        'readerContentRemainsExpanded',
        'readerHoldSurvivesUpdates',
      ])
        assert.equal(report[key].expanded, 'true', key)
      for (const key of ['liveInitiallyCollapsed', 'liveManualCollapseSurvives', 'liveSettledCollapsed']) {
        assert.equal(report[key].expanded, 'false', key)
        assert.equal(report[key].cards, 0, key)
        assert.equal(report[key].groups, 1, key)
      }
      assert.match(report.liveInitiallyCollapsed.label, /运行中.*运行检查 0/u)
      assert.match(report.liveManualCollapseSurvives.label, /运行中.*运行检查 2/u)
      assert.match(report.liveSettledCollapsed.label, /1 项失败.*1 项已取消/u)
      for (const [key, cards] of [['liveExpanded', 2], ['liveAppendPreservesExpansion', 3], ['settledExpanded', 3]]) {
        assert.equal(report[key].expanded, 'true', key)
        assert.equal(report[key].cards, cards, key)
      }
      assert.equal(report.liveAppendPreservesExpansion.hasText, true)
      assert.equal(report.liveSettledCollapsed.hasText, true)
      for (const key of ['thinkingInitiallyCollapsed', 'thinkingStageCollapsed', 'thinkingManuallyCollapsed', 'thinkingBeforeTool']) {
        assert.equal(report[key].expanded, 'false', key)
        assert.equal(report[key].text, null, key)
      }
      assert.match(report.thinkingInitiallyCollapsed.label, /思考中/u)
      assert.match(report.thinkingStageCollapsed.label, /检查配置/u)
      assert.doesNotMatch(report.thinkingStageCollapsed.label, /思考正文/u)
      for (const key of ['thinkingExpandedUpdates', 'thinkingExpandedAfterEnd']) {
        assert.equal(report[key].expanded, 'true', key)
        assert.match(report[key].text, /思考正文/u)
      }
      assert.equal(report.thinkingBeforeTool.label, '思考过程')
      assert.equal(report.timerInitiallyExpanded.elapsed, '1分3秒')
      assert.equal(report.timerAfterDetailsToggle.elapsed, '1分3秒')
      assert.equal(report.timerCollapsed.cards, 0, '折叠应真正卸载卡片，而不是保活来掩盖计时问题')
      assert.equal(report.timerReopened.elapsed, '2分9秒', '重挂载后继续从真实执行起点计时，包含折叠期间')
      assert.equal(report.timerMissingStart.elapsed, null)
      assert.match(report.timerMissingStart.cardText, /运行中/u)
      assert.equal(report.timerQueued.elapsed, null)
      assert.match(report.timerQueued.cardText, /排队中/u)
      assert.equal(report.timerCompleted.elapsed, null)
      assert.match(report.timerCompleted.cardText, /2秒/u)
      assert.equal(report.highlightPerformance.preserved, true)
      console.info('Execution highlight timings (ms):', JSON.stringify(report.highlightPerformance))
    } finally {
      clearTimeout(timeout)
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await rm(directory, { recursive: true, force: true })
    }
  }
)
