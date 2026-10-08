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
    skip: !electronPath && 'Set VELAROS_UI_ELECTRON_PATH to reuse an installed Electron runtime',
  },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'velaros-processed-activity-'))
    let child
    let timeout
    try {
      await writeFile(
        join(directory, 'index.html'),
        `<html><body><div id="root"></div><script type="module" src="${join(root, 'test/fixtures/processedActivityLifecycle.tsx')}"></script></body></html>`
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
    } finally {
      clearTimeout(timeout)
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await rm(directory, { recursive: true, force: true })
    }
  }
)
