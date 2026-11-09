import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { build } from 'vite'

test('mounted composer preserves editing shortcuts and cancels revoked file drags', { timeout: 45_000 }, async () => {
  const root = resolve(import.meta.dirname, '..')
  const output = await mkdtemp(join(tmpdir(), 'velaros-composer-interaction-'))
  let child
  let timeout
  try {
    await build({
      configFile: false, root, logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      resolve: { alias: { '#contracts': join(root, 'src/conversation/contracts/index.ts'), '#internal': join(root, 'src/conversation/internal'), '@velaros-ai/ui': join(root, 'src') } },
      build: { outDir: join(output, 'bundle'), emptyOutDir: true, lib: { entry: join(root, 'test/fixtures/composerInteractionLifecycle.tsx'), formats: ['iife'], name: 'ComposerInteractionRegression', fileName: () => 'scene.js', cssFileName: 'scene' } },
    })
    await writeFile(join(output, 'bundle/index.html'), '<html><head><link rel="stylesheet" href="scene.css"></head><body><div id="root"></div><script src="scene.js"></script></body></html>')
    await writeFile(join(output, 'main.cjs'), `
const { app, BrowserWindow } = require('electron');
app.setPath('userData', ${JSON.stringify(join(output, 'user-data'))});
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, offscreen: true } });
  try {
    await win.loadFile(${JSON.stringify(join(output, 'bundle/index.html'))});
    const result = await win.webContents.executeJavaScript('runComposerInteractionRegression().catch(error => ({ error: error.stack }))');
    if (result.error) throw Error(result.error);
    console.log('COMPOSER_INTERACTION_PASS ' + JSON.stringify(result));
    win.destroy(); app.exit(0);
  } catch (error) { console.error(error); win.destroy(); app.exit(1); }
});`)
    const require = createRequire(import.meta.url)
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    child = spawn(process.env.VELAROS_UI_ELECTRON_PATH || require('electron'), [join(output, 'main.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    child.stdout.on('data', (chunk) => { log += chunk })
    child.stderr.on('data', (chunk) => { log += chunk })
    timeout = setTimeout(() => child.kill('SIGKILL'), 30_000)
    const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit) })
    assert.equal(code, 0, log)
    assert.match(log, /COMPOSER_INTERACTION_PASS/)
  } finally {
    clearTimeout(timeout)
    if (child && child.exitCode === null) child.kill('SIGKILL')
    await rm(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})
