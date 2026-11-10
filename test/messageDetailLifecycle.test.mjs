import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('message details preserve composition, preview bounds and expanded view identity', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/messageDetailLifecycle.tsx', 'runMessageDetailRegression')
})
