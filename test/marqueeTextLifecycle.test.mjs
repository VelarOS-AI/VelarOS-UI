import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('marquee keeps its resting text and hover target stationary through the loop', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/marqueeTextLifecycle.tsx', 'runMarqueeTextRegression')
})
