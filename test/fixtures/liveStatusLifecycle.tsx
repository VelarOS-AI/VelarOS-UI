import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { useQueuedLiveStatusText } from '../../src/conversation/shell/useQueuedLiveStatusText'

const root = createRoot(document.getElementById('root')!)
function Status({
  value,
  resetKey,
  enabled,
}: {
  value?: string
  resetKey: string
  enabled: boolean
}): React.ReactElement {
  const text = useQueuedLiveStatusText(value, enabled, resetKey)
  return <output>{text}</output>
}
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30))
const read = (): string => document.querySelector('output')!.textContent ?? ''
async function render(
  value: string | undefined,
  resetKey = 'session:run',
  enabled = true
): Promise<void> {
  flushSync(() => root.render(<Status value={value} resetKey={resetKey} enabled={enabled} />))
  await settle()
}
function expectText(expected: string): void {
  if (read() !== expected) throw new Error(`Expected ${expected}, received ${read()}`)
}

async function runLiveStatusRegression(): Promise<void> {
  await render('Read files')
  await render('Check types')
  await render('Start verification server')
  expectText('Read files')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  expectText('Start verification server')

  await render('Queued old activity')
  await render('Stopping', 'session:run:stopping')
  expectText('Stopping')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  expectText('Stopping')

  await render('New session', 'other:run')
  expectText('New session')
  await render('Queued activity', 'other:run')
  await render(undefined, 'other:run', false)
  expectText('')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  expectText('')
  root.unmount()
}
Object.assign(window, { runLiveStatusRegression })
