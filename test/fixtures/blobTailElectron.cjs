// 验证真实渲染中的行内尾标及分组展开。
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const directory = process.argv[2]
app.setPath('userData', path.join(directory, 'user-data'))
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, sandbox: true } })
  const errors = []
  window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
  try {
    await window.loadFile(path.join(directory, 'dist/index.html'))
    const report = await window.webContents.executeJavaScript(`(async () => {
      for (let i = 0; i < 100 && !document.querySelector('p [data-active-tail-marker="true"] svg'); i++) await new Promise(r => setTimeout(r, 30));
      const slot = document.querySelector('p [data-active-tail-marker="true"]');
      const inline = !!slot?.querySelector('svg') && slot.parentElement.textContent.includes('最后一行');
      const button = document.querySelector('[data-slot="script-execution"] > button');
      if (button.getAttribute('aria-expanded') !== 'false') throw Error('blobs must start collapsed');
      button.click();
      await new Promise(r => setTimeout(r, 50));
      const fields = [...document.querySelectorAll('[data-slot="blob-field"]')];
      for (const name of ['list','dialog','css']) if (!fields.some(f => f.textContent.includes(name) && f.textContent.includes('literal-' + name))) throw Error('missing field ' + name);
      return { inline, fields: fields.length };
    })()`)
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ ...report, errors }))
    app.exit(0)
  } catch (error) { console.error(error); app.exit(1) }
})
