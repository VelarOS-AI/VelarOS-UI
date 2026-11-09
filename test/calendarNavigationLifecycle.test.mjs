import { test } from 'node:test'

import { runBrowserScene } from './support/runBrowserScene.mjs'

test('date pickers navigate months, retain selection and enforce range limits', { timeout: 45_000 }, async () => {
  await runBrowserScene('test/fixtures/calendarNavigationLifecycle.tsx', 'runCalendarNavigationRegression')
})
