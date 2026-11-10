import React from 'react'
import { createRoot } from 'react-dom/client'

import { HtmlPreviewToolbar } from '../../src/conversation/html-preview/HtmlPreviewToolbar'

const root = createRoot(document.getElementById('root')!)
let resolveCopy: () => void
let rejectCopy: (error: Error) => void
let immediate = false
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
  writeText: () => immediate ? Promise.resolve() : new Promise<void>((resolve, reject) => { resolveCopy = resolve; rejectCopy = reject }),
} })
function render(visible: boolean): void {
  root.render(visible ? <HtmlPreviewToolbar copyLabel="copy" copiedLabel="copied" copyValue="<p>proof</p>"
    downloadLabel="download" reloadLabel="reload" showCode={false} showCodeLabel="show code" hideCodeLabel="hide code"
    actionButtonClassName="" onDownload={() => {}} onReload={() => {}} onToggleCode={() => {}} /> : <div />)
}
async function settle(): Promise<void> { for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame) }
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
function copy(): void { document.querySelector<HTMLButtonElement>('[aria-label="copy"]')!.click() }

Object.assign(window, {
  async runHtmlPreviewCopyRegression(): Promise<string[]> {
    const errors: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent): void => { errors.push(event.reason); event.preventDefault() }
    window.addEventListener('unhandledrejection', onUnhandled)
    render(true)
    await settle()
    copy()
    render(false)
    await settle()
    resolveCopy()
    await settle()
    expect(errors.length === 0, 'A late clipboard success must not register timers after unmount')
    render(true)
    await settle()
    copy()
    rejectCopy(Error('Clipboard permission denied'))
    await settle()
    expect(errors.length === 0 && !document.querySelector('[aria-label="copied"]'), 'A failed clipboard operation must stay unsuccessful without an unhandled rejection')
    immediate = true
    copy()
    await settle()
    expect(!!document.querySelector('[aria-label="copied"]'), 'Successful mounted copy must still display its feedback')
    await new Promise((resolve) => setTimeout(resolve, 1750))
    expect(!!document.querySelector('[aria-label="copy"]'), 'Copy feedback must reset after the existing delay')
    root.unmount()
    window.removeEventListener('unhandledrejection', onUnhandled)
    return ['late clipboard completion after unmount', 'permission failure and mounted success feedback']
  },
})
