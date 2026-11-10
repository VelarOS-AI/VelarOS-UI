import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('preview copy ignores late success after unmount and consumes clipboard failure', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/htmlPreviewCopyLifecycle.tsx', 'runHtmlPreviewCopyRegression')
})
