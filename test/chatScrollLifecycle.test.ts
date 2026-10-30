import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { build } from 'vite'

void test(
  'real Chromium preserves scroll across lazy mount and terminal remount',
  { timeout: 45000 },
  async () => {
    const root = resolve(import.meta.dirname, '..')
    const output = await mkdtemp(join(tmpdir(), 'velaros-scroll-regression-'))
    await build({
      configFile: false,
      root,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': '"development"' },
      build: {
        outDir: join(output, 'bundle'),
        emptyOutDir: true,
        lib: {
          entry: join(root, 'test/fixtures/chatScrollLifecycle.tsx'),
          formats: ['iife'],
          name: 'ScrollRegression',
          fileName: () => 'scene.js',
          cssFileName: 'scene',
        },
      },
    })
    await writeFile(
      join(output, 'bundle/index.html'),
      '<html><head><link rel="stylesheet" href="scene.css"></head><body><div id="root"></div><script src="scene.js"></script></body></html>'
    )
    await writeFile(
      join(output, 'main.cjs'),
      `
const {app,BrowserWindow}=require('electron');
app.setPath('userData',${JSON.stringify(join(output, 'user-data'))});
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:900,height:900,webPreferences:{backgroundThrottling:false,offscreen:true}});
 win.webContents.on('console-message',event=>console.error(event.message));
 try {await win.loadFile(${JSON.stringify(join(output, 'bundle/index.html'))});
 const results=await win.webContents.executeJavaScript('window.runScrollLifecycleRegression().catch(error=>({error:error.stack}))');
 if(results.error)throw Error(results.error);
 console.log('SCROLL_REGRESSION_PASS '+JSON.stringify(results));app.exit(0);
 }catch(error){console.error(error);app.exit(1)}
});`
    )
    const require = createRequire(import.meta.url)
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(
      process.env.VELAROS_UI_ELECTRON_PATH || require('electron'),
      [join(output, 'main.cjs')],
      { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let log = ''
    child.stdout.on('data', (data) => {
      log += data
    })
    child.stderr.on('data', (data) => {
      log += data
    })
    const timer = setTimeout(() => child.kill(), 30000)
    try {
      const code = await new Promise((resolveExit, reject) => {
        child.on('error', reject)
        child.on('exit', resolveExit)
      })
      assert.equal(code, 0, log)
      assert.match(log, /SCROLL_REGRESSION_PASS/)
    } finally {
      clearTimeout(timer)
      if (child.exitCode === null) child.kill()
    }
  }
)
