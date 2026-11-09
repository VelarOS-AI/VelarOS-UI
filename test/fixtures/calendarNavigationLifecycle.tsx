import React from 'react'
import { createRoot } from 'react-dom/client'

import { CalendarDatePicker, CalendarDateRangePicker } from '../../src/primitives/forms/Calendar'

const root = createRoot(document.getElementById('root')!)
let single: string | null = '2026-06-10'
let range = { start: '2026-06-10', end: '2026-06-12' }
let rangeChanges = 0

function render(): void {
  root.render(<>
    <CalendarDatePicker ariaLabel="single-trigger" calendarLabel="single-calendar" value={single}
      onChange={(value) => { single = value; render() }} />
    <CalendarDateRangePicker ariaLabel="range-trigger" calendarLabel="range-calendar" value={range}
      minValue="2026-05-01" maxValue="2026-08-31"
      onChange={(value) => { if (value) range = value; rangeChanges++; render() }} />
  </>)
}
async function settle(): Promise<void> {
  for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame)
}
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
function calendar(label: string): HTMLElement { return document.querySelector(`[role="group"][aria-label="${label}"]`)! }
async function click(selector: string, scope: ParentNode = document): Promise<void> {
  const button = scope.querySelector<HTMLButtonElement>(selector)
  if (!button) throw Error(`Missing calendar button: ${selector}`)
  button.click()
  await settle()
}
function month(label: string): string { return calendar(label).querySelector('.velar-calendar-month-label')!.textContent! }

Object.assign(window, {
  async runCalendarNavigationRegression(): Promise<string[]> {
    render()
    await settle()
    await click('[aria-label="single-trigger"]')
    expect(month('single-calendar') === 'June 2026', 'Opening a selected old date must start in its month')
    await click('.velar-calendar-nav-button-next', calendar('single-calendar'))
    expect(month('single-calendar') === 'July 2026', 'Single picker must navigate to the next month')
    expect(single === '2026-06-10', 'Navigating must not change the selected date')
    await click('[data-day="2026-07-12"] button', calendar('single-calendar'))
    expect(single === '2026-07-12', 'Single picker must select a date in the navigated month')
    await click('[aria-label="single-trigger"]')
    expect(month('single-calendar') === 'July 2026', 'Reopening must start at the newly selected date')
    await click('[aria-label="single-trigger"]')

    await click('[aria-label="range-trigger"]')
    expect(month('range-calendar') === 'June 2026', 'Range picker must start at the existing range')
    await click('.velar-calendar-nav-button-next', calendar('range-calendar'))
    expect(month('range-calendar') === 'July 2026', 'Range picker must navigate before the first selection')
    await click('[data-day="2026-07-25"] button', calendar('range-calendar'))
    expect(rangeChanges === 0, 'A partial range must not be committed')
    await click('.velar-calendar-nav-button-next', calendar('range-calendar'))
    expect(month('range-calendar') === 'August 2026', 'Selecting a start must retain cross-month navigation')
    expect(calendar('range-calendar').querySelector('.velar-calendar-nav-button-next')!.getAttribute('aria-disabled') === 'true', 'Maximum month must disable forward navigation')
    await click('.velar-calendar-nav-button-next', calendar('range-calendar'))
    expect(month('range-calendar') === 'August 2026', 'Clicking disabled forward navigation must keep the maximum month')
    await click('[data-day="2026-08-05"] button', calendar('range-calendar'))
    expect(rangeChanges === 1 && range.start === '2026-07-25' && range.end === '2026-08-05', 'A cross-month range must commit exactly once')
    await click('[aria-label="range-trigger"]')
    expect(month('range-calendar') === 'July 2026', 'Reopening a range must start at the committed start date')
    await click('.velar-calendar-nav-button-previous', calendar('range-calendar'))
    await click('.velar-calendar-nav-button-previous', calendar('range-calendar'))
    expect(month('range-calendar') === 'May 2026', 'Range picker must navigate to the minimum month')
    expect(calendar('range-calendar').querySelector('.velar-calendar-nav-button-previous')!.getAttribute('aria-disabled') === 'true', 'Minimum month must disable backward navigation')
    await click('.velar-calendar-nav-button-previous', calendar('range-calendar'))
    expect(month('range-calendar') === 'May 2026', 'Clicking disabled backward navigation must keep the minimum month')
    root.unmount()
    return ['single date navigation and selected-month reopening', 'cross-month range selection with minimum and maximum limits']
  },
})
