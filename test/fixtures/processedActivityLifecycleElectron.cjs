const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const directory = process.argv[2]
app.setPath('userData', path.join(directory, 'user-data'))
app.dock?.hide()

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  const run = (source) => window.webContents.executeJavaScript(source)
  const results = { errors: [] }
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') results.errors.push(event.message)
  })
  try {
    await window.loadFile(path.join(directory, 'dist', 'index.html'))
    await run('processedActivityProof.render("ordinary",true)')
    await run('processedActivityProof.flushFrames()')
    await run('processedActivityProof.render("ordinary",false)')
    for (let index = 0; index < 10; index += 1)
      await run(`processedActivityProof.render("ordinary",false,${index})`)
    await run('processedActivityProof.flushFrames()')
    results.completedWithoutInteraction = await run('processedActivityProof.read()')
    await run('processedActivityProof.toggle()')
    for (let index = 10; index < 20; index += 1)
      await run(`processedActivityProof.render("ordinary",false,${index})`)
    await run('processedActivityProof.flushFrames()')
    results.manualExpansionSurvivesUpdates = await run('processedActivityProof.read()')
    await run('processedActivityProof.render("ordinary",true,20)')
    await run('processedActivityProof.flushFrames()')
    await run('processedActivityProof.render("ordinary",false,21)')
    await run('processedActivityProof.flushFrames()')
    results.nextCompletionOnSameMessage = await run('processedActivityProof.read()')

    await run('processedActivityProof.render("paused",true)')
    await run('processedActivityProof.flushFrames()')
    await run('processedActivityProof.render("paused",false)')
    results.beforePausedFrames = await run('processedActivityProof.read()')
    await new Promise((resolve) => setTimeout(resolve, 1_300))
    await run('processedActivityProof.flushFrames()')
    results.resumedWithoutInteraction = await run('processedActivityProof.read()')

    await run('processedActivityProof.follow(false)')
    await run('processedActivityProof.render("reading",true)')
    await run('processedActivityProof.flushFrames()')
    await run('processedActivityProof.render("reading",false)')
    await run('processedActivityProof.flushFrames()')
    results.readerContentRemainsExpanded = await run('processedActivityProof.read()')
    await run('processedActivityProof.follow(true)')
    await run('processedActivityProof.render("reading",false,1)')
    await run('processedActivityProof.flushFrames()')
    results.readerHoldSurvivesUpdates = await run('processedActivityProof.read()')

    await run('processedActivityProof.follow(false)')
    await run('processedActivityProof.render("history",false)')
    await run('processedActivityProof.flushFrames()')
    results.historicalCompletedMount = await run('processedActivityProof.read()')
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(results, null, 2))
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    window.destroy()
    app.quit()
  }
})
