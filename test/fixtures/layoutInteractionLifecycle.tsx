import React from 'react'
import { createRoot } from 'react-dom/client'

import { DescriptionItem, DescriptionList } from '../../src/primitives/layout/DescriptionList'
import { SessionStickyDock } from '../../src/product/layout/SessionStickyDock'

import '../../src/styles/tokens/design-tokens.css'
import '../../src/styles/components/primitives/description-list.css'
import '../../src/styles/components/product/session-sticky-dock.css'

const root = createRoot(document.getElementById('root')!)
let collapseKey = 'initial'
function Descriptions(): React.ReactElement {
  return <DescriptionList columns={2}>
    <DescriptionItem id="ordinary-row" label="Role">Software engineer</DescriptionItem>
    <DescriptionItem id="full-row" label="Notes" spanFull>Full width</DescriptionItem>
  </DescriptionList>
}
function render(): void {
  root.render(<>
    <Descriptions />
    <SessionStickyDock barLabel="Goal actions" autoCollapseKey={collapseKey}
      items={[{ id: 'goal', content: <><button id="dock-action">Pause goal</button><input id="dock-draft" defaultValue="draft" /></> }]} />
  </>)
}
async function settle(): Promise<void> { for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame) }
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
function columns(node: Element): number { return node.ownerDocument.defaultView!.getComputedStyle(node).gridTemplateColumns.split(' ').length }

Object.assign(window, {
  async runLayoutInteractionRegression(): Promise<string[]> {
    render()
    await settle()
    expect(columns(document.getElementById('ordinary-row')!) === 2, 'Wide description rows must have separate label and value columns')
    expect(columns(document.getElementById('full-row')!) === 1, 'Full-width description rows must remain stacked')
    const frame = document.createElement('iframe')
    frame.style.width = '400px'
    frame.srcdoc = `<html><head><link rel="stylesheet" href="${document.querySelector<HTMLLinkElement>('link')!.href}"></head><body><div id="narrow-root"></div></body></html>`
    const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
    document.body.append(frame)
    await loaded
    const narrowRoot = createRoot(frame.contentDocument!.getElementById('narrow-root')!)
    narrowRoot.render(<Descriptions />)
    await settle()
    expect(columns(frame.contentDocument!.getElementById('ordinary-row')!) === 1, 'Narrow description rows must stack without overriding the wide layout')
    narrowRoot.unmount()
    frame.remove()

    const trigger = document.querySelector<HTMLButtonElement>('.velar-session-sticky-dock-trigger')!
    const action = document.getElementById('dock-action')!
    const draft = document.getElementById('dock-draft') as HTMLInputElement
    const fabric = document.querySelector<HTMLElement>('.velar-session-sticky-dock-fabric-clip')!
    expect(trigger.getAttribute('aria-label') === 'Goal actions', 'The dock trigger must use its existing localized label')
    action.focus()
    expect(fabric.inert && document.activeElement !== action, 'A collapsed dock must exclude hidden actions from native focus')
    trigger.click()
    await settle()
    action.focus()
    expect(!fabric.inert && document.activeElement === action, 'Expanded actions must regain native focus eligibility')
    draft.value = 'retained draft'
    collapseKey = 'settled'
    render()
    await settle()
    expect(fabric.inert && document.activeElement === trigger, 'Automatic collapse must return body focus to the trigger')
    action.focus()
    expect(document.activeElement !== action, 'Hidden actions must remain unfocusable after collapse')
    trigger.click()
    await settle()
    expect(document.getElementById('dock-action') === action && draft.value === 'retained draft', 'Opening the dock must preserve its mounted content and draft')
    root.unmount()
    return ['wide, narrow and full-width description layout', 'collapsed focus exclusion, focus restoration and mounted-content preservation']
  },
})
