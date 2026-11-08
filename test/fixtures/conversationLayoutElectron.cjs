// 用途：隐藏 Electron 中以真实鼠标命中验证 CSS hover 连通性，不操作用户屏幕。
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const directory = process.argv[2]
app.setPath('userData', path.join(directory, 'user-data'))
app.dock?.hide()

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1100,
    height: 1000,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  const results = { errors: [] }
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') results.errors.push(event.message)
  })
  const proof = async (method, ...args) => {
    const source = `conversationLayoutProof.${method}(${args.map((arg) => JSON.stringify(arg)).join(',')})`
    const result = await window.webContents.executeJavaScript(`(async () => {
      try { return { ok: true, value: await (${source}) } }
      catch(error) { return { ok: false, error: String(error.stack || error), html: document.body.innerHTML } }
    })()`)
    if (!result.ok)
      throw new Error(`Layout stage ${source}: ${result.error}\n${results.errors.join('\n')}\nDOM: ${result.html}`)
    return result.value
  }
  const mouse = (type, point) =>
    window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type,
      ...point,
      ...(type === 'mouseMoved' ? {} : { button: 'left', clickCount: 1 }),
    })
  const click = async (point) => {
    await mouse('mousePressed', point)
    await mouse('mouseReleased', point)
    await proof('frame')
  }
  try {
    await window.loadFile(path.join(directory, 'dist/index.html'))
    window.webContents.debugger.attach('1.3')
    await proof('render')
    await proof('frame')
    results.defaults = await proof('measure')
    await proof('render', true)
    await proof('frame')
    results.custom = await proof('measure')
    results.actions = []
    for (const kind of ['copy', 'rewind']) {
      const points = await proof('actionPoints', kind)
      await mouse('mouseMoved', points.bubble)
      await proof('frame')
      await mouse('mouseMoved', points.bridge)
      await proof('frame')
      await mouse('mouseMoved', points.action)
      await proof('frame')
      results.actions.push({
        kind,
        ...(await proof('actionAtPoint', kind, points.action)),
      })
      await click(points.action)
      if (kind === 'rewind') await click(await proof('confirmPoint'))
    }
    results.afterActions = await proof('measure')
    await mouse('mouseMoved', { x: 1050, y: 950 })
    await proof('render', true, 360)
    await proof('frame')
    results.narrow = await proof('measure')
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(results, null, 2))
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    window.destroy()
    app.quit()
  }
})
