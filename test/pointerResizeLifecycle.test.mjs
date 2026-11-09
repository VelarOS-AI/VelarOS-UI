import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('resize owns its admitted pointer and releases global effects on every exit', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/pointerResizeLifecycle.tsx', 'runPointerResizeRegression')
})
