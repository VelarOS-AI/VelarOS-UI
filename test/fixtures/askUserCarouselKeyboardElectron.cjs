const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const directory = process.argv[2]
app.setPath('userData', path.join(directory, 'user-data'))
app.dock?.hide()

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  })
  const run = async (source) => {
    const result = await window.webContents.executeJavaScript(`(() => {
      try { return { ok: true, value: (${source}) } }
      catch (error) {
        return {
          ok: false,
          error: String(error.stack || error),
          html: document.getElementById('root')?.innerHTML
        }
      }
    })()`)
    if (!result.ok)
      throw new Error(`Renderer stage ${source}: ${result.error}\nDOM: ${result.html}`)
    return result.value
  }
  const proof = (method, ...args) =>
    run(`carouselKeyboardProof.${method}(${args.map((arg) => JSON.stringify(arg)).join(',')})`)
  const results = { errors: [] }
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') {
      results.errors.push(event.message)
      console.error(`Renderer console: ${event.message}`)
    }
  })
  const enter = () => proof('dispatchKey', {})

  try {
    await window.loadFile(path.join(directory, 'dist/index.html'))
    await proof('render', 'single')
    await enter()
    results.requiredEmpty = await proof('read')
    await proof('fill', 'An answer')
    await enter()
    results.single = await proof('read')
    await enter()
    results.lockedAfterSend = await proof('read')

    await proof('render', 'multiple')
    await enter()
    results.skippedPage = await proof('read')
    await proof('fill', 'Last answer')
    await enter()
    results.missingEarlierAnswer = await proof('read')
    await proof('click', 'userActionForm.wizardPrev')
    await proof('fill', 'First answer')
    await enter()
    results.returnedToLast = await proof('read')
    await enter()
    results.multiple = await proof('read')

    await proof('render', 'choice')
    await proof('click', 'ASafe route')
    await enter()
    results.choice = await proof('read')

    await proof('render', 'numeric')
    await proof('fill', '7')
    await enter()
    results.numeric = await proof('read')

    await proof('render', 'single')
    await proof('fill', 'Guarded answer')
    results.guards = []
    for (const guard of [
      { isComposing: true },
      { keyCode: 229 },
      { repeat: true },
      { shiftKey: true },
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { key: 'Escape' },
    ]) {
      const prevented = await proof('dispatchKey', guard)
      results.guards.push({ guard, prevented, state: await proof('read') })
    }
    await enter()
    results.afterGuards = await proof('read')

    await proof('render', 'prevented')
    await proof('fill', 'Owned by the parent')
    await enter()
    results.parentPrevented = await proof('read')

    await proof('render', 'locked')
    await proof('dispatchKey', {})
    results.locked = await proof('read')
    await proof('click', 'userActionForm.wizardNext')
    results.lockedNavigation = await proof('read')
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(results, null, 2))
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    window.destroy()
    app.quit()
  }
})
