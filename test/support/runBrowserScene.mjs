import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { build } from 'vite'

/** 在隔离的隐藏 Chromium 中运行真实组件场景，结束后回收进程与专属临时目录。 */
export async function runBrowserScene(fixture, functionName) {
  const root = resolve(import.meta.dirname, '../..')
  const temporaryRoot = resolve(tmpdir())
  const output = await mkdtemp(join(temporaryRoot, 'velaros-ui-browser-'))
  if (dirname(output) !== temporaryRoot) throw Error('Unexpected browser scene directory')
  let child
  let timer
  try {
    await build({
      configFile: false, root, logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      resolve: { alias: { '#contracts': join(root, 'src/conversation/contracts/index.ts'), '#internal': join(root, 'src/conversation/internal'), '@velaros-ai/ui': join(root, 'src') } },
      build: { outDir: join(output, 'bundle'), emptyOutDir: true, lib: { entry: join(root, fixture), formats: ['iife'], name: 'BrowserScene', fileName: () => 'scene.js', cssFileName: 'scene' } },
    })
    const style = existsSync(join(output, 'bundle/scene.css')) ? '<link rel="stylesheet" href="scene.css">' : ''
    await writeFile(join(output, 'bundle/index.html'), `<html><head><meta charset="utf-8">${style}</head><body><div id="root"></div><script src="scene.js"></script></body></html>`)
    await writeFile(join(output, 'main.cjs'), `
const { app, BrowserWindow } = require('electron');
app.setPath('userData', ${JSON.stringify(join(output, 'user-data'))});
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { backgroundThrottling: false, offscreen: true } });
  win.webContents.on('console-message', event => console.error(event.message));
  try {
    await win.loadFile(${JSON.stringify(join(output, 'bundle/index.html'))});
    const result = await win.webContents.executeJavaScript(${JSON.stringify(`${functionName}().catch(error => ({ error: error.stack }))`)});
    if (result.error) throw Error(result.error);
    console.log('BROWSER_SCENE_PASS ' + JSON.stringify(result)); win.destroy(); app.exit(0);
  } catch (error) { console.error(error); win.destroy(); app.exit(1); }
});`)
    const require = createRequire(import.meta.url)
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    child = spawn(process.env.VELAROS_UI_ELECTRON_PATH || require('electron'), [join(output, 'main.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    child.stdout.on('data', (chunk) => { log += chunk })
    child.stderr.on('data', (chunk) => { log += chunk })
    timer = setTimeout(() => child.kill('SIGKILL'), 30_000)
    const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit) })
    assert.equal(code, 0, log)
    assert.match(log, /BROWSER_SCENE_PASS/)
  } finally {
    clearTimeout(timer)
    if (child && child.exitCode === null) child.kill('SIGKILL')
    await rm(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
