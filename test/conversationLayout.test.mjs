// 用途：公共主题入口、时间真实占高与用户操作跨间隙命中，均由实际 DOM 验收。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import tailwindcss from '@tailwindcss/vite'
import { build } from 'vite'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

test(
  'conversation layout owns theme spacing, measured timestamps and continuous action hover',
  { timeout: 30000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'velaros-conversation-layout-'))
    let child
    let timeout
    try {
      await build({
        configFile: false,
        root,
        base: './',
        publicDir: false,
        logLevel: 'silent',
        plugins: [tailwindcss()],
        oxc: { jsx: { runtime: 'automatic' } },
        define: { 'process.env.NODE_ENV': '"development"' },
        resolve: { dedupe: ['react', 'react-dom'] },
        build: {
          outDir: join(directory, 'dist'),
          emptyOutDir: true,
          cssMinify: false,
          lib: {
            entry: join(root, 'test/fixtures/conversationLayout.tsx'),
            formats: ['iife'],
            name: 'ConversationLayoutFixture',
            fileName: () => 'scene.js',
            cssFileName: 'scene',
          },
        },
      })
      await writeFile(
        join(directory, 'dist/index.html'),
      '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="scene.css"><style>html{font-size:16px}body{margin:20px}*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}</style></head><body><div id="root"></div><script src="scene.js"></script></body></html>'
      )
      const environment = { ...process.env }
      delete environment.ELECTRON_RUN_AS_NODE
      child = spawn(
        environment.VELAROS_UI_ELECTRON_PATH || require('electron'),
        [join(root, 'test/fixtures/conversationLayoutElectron.cjs'), directory],
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
      timeout = setTimeout(() => child.kill('SIGKILL'), 25000)
      const code = await new Promise((resolveExit, reject) => {
        child.once('error', reject)
        child.once('exit', resolveExit)
      })
      assert.equal(code, 0, errors)
      const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))
      assert.deepEqual(report.errors, [])
      assert.equal(report.defaults.mainGap, '20px')
      assert.equal(report.defaults.sideGap, '12px')
      assert.equal(report.defaults.lineHeight, '24px')
      assert.equal(report.custom.mainGap, '16px')
      assert.equal(report.custom.sideGap, '16px')
      assert.ok(
        Math.abs(parseFloat(report.custom.lineHeight) / parseFloat(report.custom.fontSize) - 1.55) <
          0.001
      )
      for (const measured of [report.defaults, report.custom, report.narrow]) {
        assert.ok(
          measured.paragraph.height >= parseFloat(measured.lineHeight) * 2 - 0.5,
          '真实两行正文'
        )
        assert.ok(measured.time.top >= measured.bubble.bottom, '时间显示在气泡下方')
        assert.ok(measured.time.bottom <= measured.first.bottom + 0.5, '消息测量包含时间占高')
        assert.ok(measured.second.top >= measured.time.bottom - 0.5, '时间不侵入下一条消息')
      }
      for (const action of report.actions) {
        assert.equal(action.hit, true, action.kind)
        assert.equal(action.opacity, '1', action.kind)
      }
      assert.deepEqual(report.afterActions.copied, ['First line\nSecond line'])
      assert.deepEqual(report.afterActions.rewound, ['first'])
    } finally {
      clearTimeout(timeout)
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await rm(directory, { recursive: true, force: true })
    }
  }
)
