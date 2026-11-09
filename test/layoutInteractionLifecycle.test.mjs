import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('collapsed dock releases focus and description columns follow viewport layout', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/layoutInteractionLifecycle.tsx', 'runLayoutInteractionRegression')
})
