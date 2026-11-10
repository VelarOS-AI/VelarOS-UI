import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('goal dock rejects late replies and continuations outside the mounted session scope', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/goalDockLifecycle.tsx', 'runGoalDockRegression')
})
