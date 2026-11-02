import React from 'react'
import { createRoot } from 'react-dom/client'

import { ConversationLocalizationProvider } from '../../src/conversation/i18n'
import { ConversationViewMemoryProvider, useConversationViewExpansion } from '../../src/conversation/react-hooks/conversationViewMemory'
import { AutoScrollSuspendEventName } from '../../src/conversation/react-hooks/scrollBehavior'
import { useScrollToBottom } from '../../src/conversation/react-hooks/useScrollToBottom'
import { ChatScrollNavigator } from '../../src/conversation/shell/ChatScrollNavigator'
import { SessionStickyDock } from '../../src/product/layout/SessionStickyDock'

import '../../src/styles/tokens/design-tokens.css'
import '../../src/styles/components/product.css'

const positions = new Map<string, number>()
const root = createRoot(document.getElementById('root')!)
let lockFollow: (locked: boolean) => void
interface Scene { visible: boolean; generation: number; session: string; height: number; prefix?: number; remember?: boolean }
const scene: Scene = { visible: false, generation: 0, session: 'first', height: 3000 }

function ExpansionProbe() {
  const [expanded, setExpanded] = useConversationViewExpansion('probe', false)
  return <button id="expansion-probe" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Toggle</button>
}
function Harness(props: Scene): React.ReactElement {
  const { scrollRef, setFollowLocked } = useScrollToBottom(props.height, props.session, {
    restoreKey: props.session,
    rememberView: props.remember,
    readScrollTop: () => positions.get(props.session) ?? null,
    writeScrollTop: (top) => positions.set(props.session, top),
  })
  lockFollow = setFollowLocked
  return <ConversationLocalizationProvider value={{ locale: 'en-US', t: (key: string) => key }}>{props.visible && <div key={props.generation} ref={scrollRef} id="viewport"
    style={{ width: 400, height: 400, overflow: 'auto' }}>
    <div><div style={{ height: props.prefix ?? 0 }} /><div data-message-id="transcript" style={{ height: props.height }}>Transcript</div></div>
  </div>}
    <ConversationViewMemoryProvider sessionId={props.session}><ExpansionProbe key={props.session} /></ConversationViewMemoryProvider>
    <ChatScrollNavigator scrollRef={scrollRef} followLocked={false} onFollowLockedChange={setFollowLocked} />
    <div id="dock-host" style={{ width: 360, boxSizing: 'border-box', padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <SessionStickyDock variant="side" initialCollapsed={false} barLabel="Goal and plan"
        items={[{ id: 'goal', content: <div id="goal">A real goal card layout</div> }]} />
    </div>
  </ConversationLocalizationProvider>
}

const settle = async (): Promise<void> => {
  for (let frame = 0; frame < 5; frame++) await new Promise(requestAnimationFrame)
}
const render = async (next: Partial<Scene>): Promise<void> => {
  Object.assign(scene, next)
  root.render(<Harness {...scene} />)
  await settle()
}
const viewport = (): HTMLDivElement => document.querySelector<HTMLDivElement>('#viewport')!
const expectNear = (actual: number, expected: number, label: string): void => {
  if (Math.abs(actual - expected) > 1) throw Error(`${label}: ${actual}, expected ${expected}`)
}

Object.assign(window, {
  async runScrollLifecycleRegression(): Promise<string[]> {
    const passed: string[] = []
    await render({ visible: false })
    await render({ visible: true })
    expectNear(viewport().scrollTop, 2600, 'Late-mounted viewport starts at bottom')
    passed.push('late mount follows bottom')

    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 600
    await settle()
    const oldViewport = viewport()
    await render({ generation: 1 })
    if (viewport() === oldViewport) throw Error('Fixture did not replace the viewport')
    expectNear(viewport().scrollTop, 600, 'Terminal remount preserves reader position')
    await render({ height: 3400 })
    expectNear(viewport().scrollTop, 600, 'Late content does not reclaim reader position')
    passed.push('terminal remount preserves reader and scroll listeners')

    lockFollow(true)
    await settle()
    await render({ generation: 2, height: 3800 })
    expectNear(viewport().scrollTop, 3400, 'Locked follow survives remount')
    lockFollow(false)
    await settle()
    await render({ generation: 3, height: 4000 })
    expectNear(viewport().scrollTop, 3600, 'Normal pinned follow survives remount')
    passed.push('locked and normal bottom follow survive remount')

    positions.set('second', 800)
    await render({ session: 'second', generation: 4 })
    expectNear(viewport().scrollTop, 800, 'Session restoration remains independent')
    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 500
    await settle()
    expectNear(positions.get('second')!, 500, 'New viewport scroll listener persists position')
    passed.push('session restore and replacement listener')

    positions.set('third', 1100)
    await render({ visible: false, session: 'third' })
    await render({ visible: true, generation: 5 })
    expectNear(viewport().scrollTop, 1100, 'Lazy session switch restores the new session')
    passed.push('session change while viewport is absent')

    for (const width of [352, 456, 720]) {
      const host = document.querySelector<HTMLElement>('#dock-host')!
      host.style.width = `${width}px`
      const dock = host.querySelector<HTMLElement>('.velar-session-sticky-dock')!
      expectNear(dock.getBoundingClientRect().width, width, 'Side dock spans reading gutters')
      expectNear(dock.getBoundingClientRect().left, host.getBoundingClientRect().left, 'Side dock left edge')
      if (host.scrollWidth > width) throw Error('Side dock introduces horizontal overflow')
    }
    passed.push('side dock full width at three pane widths')
    await render({ session: 'memory-a', remember: true, height: 3000, generation: 6 })
    expectNear(viewport().scrollTop, 2600, 'Unvisited memory session starts at bottom')
    await render({ session: 'memory-b', height: 2000, generation: 7 })
    await render({ session: 'memory-a', height: 4000, generation: 8 })
    expectNear(viewport().scrollTop, 3600, 'Returning pinned session follows new bottom')
    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 700
    await settle()
    await render({ session: 'memory-b', height: 2000, generation: 9 })
    await render({ session: 'memory-a', height: 4500, generation: 10 })
    expectNear(viewport().scrollTop, 700, 'Returning reader session preserves position')
    await render({ height: 4700 })
    expectNear(viewport().scrollTop, 700, 'Reader remains free after return')
    document.querySelector<HTMLButtonElement>('#expansion-probe')!.click()
    await settle()
    await render({ session: 'memory-b', generation: 11 })
    if (document.querySelector('#expansion-probe')!.getAttribute('aria-expanded') !== 'false') throw Error('Expansion leaked into other session')
    await render({ session: 'memory-a', generation: 12 })
    if (document.querySelector('#expansion-probe')!.getAttribute('aria-expanded') !== 'true') throw Error('Expansion was lost after unmount')
    passed.push('memory sessions preserve bottom intent, reader position and expansion')
    await render({ session: 'anchor-a', prefix: 500, height: 3000, generation: 13 })
    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 700
    await settle()
    await render({ session: 'anchor-b', prefix: 0, generation: 14 })
    await render({ session: 'anchor-a', prefix: 900, generation: 15 })
    expectNear(viewport().scrollTop, 1100, 'Restores message offset rather than stale pixels')
    await render({ prefix: 1200 })
    expectNear(viewport().scrollTop, 1400, 'Late layout preserves restored message offset')
    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 800
    await settle()
    await render({ prefix: 1400 })
    expectNear(viewport().scrollTop, 800, 'User intent releases restoration anchor')
    passed.push('message anchor survives changed and late layout without stealing user scroll')
    return passed
  },
})
