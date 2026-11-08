import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { build } from 'vite'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

test(
  'real React inputs advance and submit the carousel without host DOM keyboard patches',
  { timeout: 30_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'velaros-carousel-keyboard-'))
    let child
    let timeout
    try {
      await build({
        configFile: false,
        root,
        base: './',
        publicDir: false,
        logLevel: 'silent',
        oxc: { jsx: { runtime: 'automatic' } },
        define: { 'process.env.NODE_ENV': '"development"' },
        resolve: { dedupe: ['react', 'react-dom'] },
        build: {
          outDir: join(directory, 'dist'),
          emptyOutDir: true,
          cssMinify: false,
          lib: {
            entry: join(root, 'test/fixtures/askUserCarouselKeyboard.tsx'),
            formats: ['iife'],
            name: 'CarouselKeyboardFixture',
            fileName: () => 'scene.js',
            cssFileName: 'scene',
          },
        },
      })
      await writeFile(
        join(directory, 'dist/index.html'),
        '<html><head><link rel="stylesheet" href="scene.css"></head><body><div id="root"></div><script src="scene.js"></script></body></html>'
      )
      const environment = { ...process.env }
      delete environment.ELECTRON_RUN_AS_NODE
      child = spawn(
        environment.VELAROS_UI_ELECTRON_PATH || require('electron'),
        [join(root, 'test/fixtures/askUserCarouselKeyboardElectron.cjs'), directory],
        {
          env: environment,
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        }
      )
      let errors = ''
      child.stderr.on('data', (chunk) => {
        errors += chunk.toString()
      })
      timeout = setTimeout(() => child.kill('SIGKILL'), 25_000)
      const code = await new Promise((resolveExit, reject) => {
        child.once('error', reject)
        child.once('exit', resolveExit)
      })
      assert.equal(code, 0, errors)
      const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))
      assert.deepEqual(report.errors, [])
      assert.deepEqual(report.requiredEmpty.submitted, [])
      assert.equal(report.requiredEmpty.skips, 0)
      assert.equal(report.single.submitted.length, 1)
      assert.equal(report.single.submitted[0].first.text, 'An answer')
      assert.equal(report.lockedAfterSend.submitted.length, 1)
      assert.equal(report.lockedAfterSend.inputDisabled, true)
      assert.equal(report.skippedPage.isLastQuestion, true, '翻页不强制先答当前题，与按钮一致')
      assert.deepEqual(report.missingEarlierAnswer.submitted, [], '最终发送仍核对全部必答题')
      assert.equal(report.returnedToLast.input, 'Last answer')
      assert.deepEqual(report.multiple.submitted, [
        {
          first: { choices: [], text: 'First answer' },
          last: { choices: [], text: 'Last answer' },
        },
      ])
      assert.deepEqual(report.choice.submitted, [{ choice: { choices: ['safe'], text: '' } }])
      assert.deepEqual(report.numeric.submitted, [{ number: { choices: [], text: '7' } }])
      for (const { guard, prevented, state } of report.guards) {
        assert.deepEqual(state.submitted, [], JSON.stringify(guard))
        assert.equal(state.skips, 0, JSON.stringify(guard))
        assert.equal(prevented, false, JSON.stringify(guard))
      }
      assert.equal(report.afterGuards.submitted.length, 1)
      assert.deepEqual(report.parentPrevented.submitted, [])
      assert.equal(report.locked.inputDisabled, true)
      assert.equal(report.locked.isLastQuestion, false)
      assert.deepEqual(report.locked.submitted, [])
      assert.equal(report.lockedNavigation.isLastQuestion, true, '锁定后仍可用按钮回看各题')
    } finally {
      clearTimeout(timeout)
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await rm(directory, { recursive: true, force: true })
    }
  }
)
