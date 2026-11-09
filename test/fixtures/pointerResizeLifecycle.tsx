import React from 'react'
import { createRoot } from 'react-dom/client'

import { usePointerResize } from '../../src/hooks/usePointerResize'

const root = createRoot(document.getElementById('root')!)
const moves: number[] = []
let starts = 0
function Panel(): React.ReactElement {
  const start = usePointerResize({
    cursor: 'col-resize',
    onResizeStart: () => { starts++; return 10 },
    onResize: (_target: string, move, context) => { moves.push(context + move.deltaX) },
  })
  return <div id="grip" onPointerDown={(event) => start('panel', event)}>Resize</div>
}
async function render(visible: boolean): Promise<void> {
  root.render(visible ? <Panel /> : <div />)
  for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame)
}
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
function pointer(type: string, pointerId: number, clientX = 100, button = 0, isPrimary = true): PointerEvent {
  const event = new PointerEvent(type, { pointerId, clientX, clientY: 80, button, isPrimary, pointerType: 'mouse', bubbles: true, cancelable: true })
  ;(type === 'pointerdown' ? document.getElementById('grip')! : window).dispatchEvent(event)
  return event
}
function expectReleased(): void {
  expect(document.body.style.cursor === 'help' && document.body.style.userSelect === 'text', 'Resize must restore the prior cursor and selection styles')
}

Object.assign(window, {
  async runPointerResizeRegression(): Promise<string[]> {
    document.body.style.cursor = 'help'
    document.body.style.userSelect = 'text'
    await render(true)
    expect(!pointer('pointerdown', 1, 100, 2).defaultPrevented && starts === 0, 'Right-button presses must stay outside resize admission')
    pointer('pointerdown', 2, 100, 0, false)
    expect(starts === 0, 'A secondary pointer must not start resize')
    pointer('pointerdown', 3)
    pointer('pointermove', 4, 150)
    pointer('pointerup', 4)
    expect(moves.length === 0 && document.body.style.cursor === 'col-resize', 'Another pointer must neither move nor stop the active resize')
    pointer('pointermove', 3, 120)
    expect(moves.join() === '30', 'The admitted pointer must resize from its original coordinates')
    pointer('pointercancel', 3)
    expectReleased()
    pointer('pointermove', 3, 130)
    expect(moves.length === 1, 'Cancelled resize must remove its listeners')

    pointer('pointerdown', 5)
    pointer('pointerdown', 6, 200)
    pointer('pointermove', 5, 150)
    pointer('pointermove', 6, 225)
    expect(moves.join() === '30,35', 'Starting again must replace the previous drag without duplicate callbacks')
    pointer('pointerup', 6)
    expectReleased()
    pointer('pointerdown', 7)
    window.dispatchEvent(new Event('blur'))
    expectReleased()
    pointer('pointermove', 7, 140)
    expect(moves.length === 2, 'A blurred window must release resize listeners')
    pointer('pointerdown', 8)
    await render(false)
    expectReleased()
    pointer('pointermove', 8, 160)
    expect(moves.length === 2, 'Unmounted resize must not call the old layout callback')
    await render(true)
    pointer('pointerdown', 9)
    pointer('pointermove', 9, 110)
    pointer('pointerup', 9)
    expect(moves.join() === '30,35,20', 'A new mount must begin with one clean resize lifecycle')
    expectReleased()
    root.unmount()
    return ['primary pointer admission and pointer ownership', 'cancel, replacement, blur, unmount and remount cleanup']
  },
})
