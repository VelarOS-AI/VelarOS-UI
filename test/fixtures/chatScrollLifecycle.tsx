import React, { useRef } from 'react'
import { createRoot } from 'react-dom/client'

import type { ChatMessage } from '../../src/conversation/contracts/conversation'
import { ConversationLocalizationProvider } from '../../src/conversation/i18n'
import { ConversationViewMemoryProvider, useConversationViewExpansion } from '../../src/conversation/react-hooks/conversationViewMemory'
import { AutoScrollSuspendEventName } from '../../src/conversation/react-hooks/scrollBehavior'
import { useScrollToBottom } from '../../src/conversation/react-hooks/useScrollToBottom'
import { ChatScrollNavigator } from '../../src/conversation/shell/ChatScrollNavigator'
import type { ChatTranscriptNavigationHandle } from '../../src/conversation/shell/ChatTranscript'
import { useChatConversationScroll } from '../../src/conversation/shell/useChatConversationScroll'
import { useChatTranscriptWindow } from '../../src/conversation/shell/useChatTranscriptWindow'
import { SessionStickyDock } from '../../src/product/layout/SessionStickyDock'

import '../../src/styles/tokens/design-tokens.css'
import '../../src/styles/components/product.css'

let olderLoads = 0
const historyMessages: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
  id: `history-${i}`, role: 'user', conversationKind: 'turn-input', timestamp: i,
  blocks: [{ type: 'text', text: String(i) }],
}))
function WindowHarness({ generation = 0, entries = historyMessages }: { generation?: number; entries?: ChatMessage[] }): React.ReactElement {
  const { scrollRef } = useScrollToBottom(entries, 'window-regression')
  const navigation = useRef<ChatTranscriptNavigationHandle>(null)
  const { windowMessages } = useChatTranscriptWindow({
    messages: entries, sessionId: 'window-regression', scrollRef,
    transcriptNavigationRef: navigation, hasOlderMessages: true,
    onLoadOlderMessages: () => { olderLoads++ },
  })
  return <div key={generation} id="window-viewport" ref={scrollRef} style={{ height: 400, overflow: 'auto' }}>
    {windowMessages.map((message) => <div key={message.id} data-message-id={message.id} style={{ height: 100 }}>{message.id}</div>)}
  </div>
}

let sentinelLoads = 0
function SentinelHarness({ generation = 0 }: { generation?: number }): React.ReactElement {
  const { loadMoreSentinelRef } = useChatConversationScroll({ sessionId: 'sentinel', hasOlderMessages: true, onLoadOlderMessages: () => { sentinelLoads++ } })
  return <div key={generation}><div ref={loadMoreSentinelRef} style={{ height: 10 }}>Sentinel</div></div>
}

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
    <div><div style={{ height: props.prefix ?? 0 }} /><div data-message-id="transcript" style={{ height: props.height }}>Transcript</div><div style={{ height: "var(--velar-scroll-clamp-guard, 0px)" }} /></div>
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
    root.render(<SentinelHarness />)
    await settle()
    if (sentinelLoads !== 1) throw Error(`Expected initial sentinel load, got ${sentinelLoads}`)
    for (let i = 0; i < 3; i++) { root.render(<SentinelHarness />); await settle() }
    if (sentinelLoads !== 1) throw Error(`Rerender repeated sentinel load: ${sentinelLoads}`)
    root.render(<SentinelHarness generation={1} />)
    await settle()
    if (sentinelLoads !== 2) throw Error(`Replacement sentinel was not observed: ${sentinelLoads}`)
    passed.push('sentinel follows node identity without rerender load loops')
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
    await render({ session: 'guard-end', prefix: 0, height: 3000, generation: 16 })
    viewport().dispatchEvent(new Event(AutoScrollSuspendEventName))
    viewport().scrollTop = 2500
    await settle()
    await render({ height: 2700 })
    expectNear(viewport().scrollTop, 2500, 'Shrink preserves active reading position')
    const bottomButton = document.querySelector<HTMLButtonElement>('[aria-label="chat.scrollToBottom"]')!
    bottomButton.click()
    await settle()
    expectNear(viewport().scrollTop, 2300, 'Explicit bottom releases guard and reaches natural bottom')
    expectNear(Number.parseFloat(viewport().style.getPropertyValue('--velar-scroll-clamp-guard')) || 0, 0, 'No guard remains after bottom navigation')
    passed.push('shrink guard releases on explicit bottom navigation')
    root.render(<WindowHarness />)
    await settle()
    root.render(<WindowHarness generation={1} />)
    await settle()
    const windowViewport = document.querySelector<HTMLDivElement>('#window-viewport')!
    windowViewport.scrollTop = 200
    await settle()
    const oldFirst = windowViewport.firstElementChild!.getAttribute('data-message-id')!
    windowViewport.scrollTop = 100
    const beforeNode = Array.from(windowViewport.querySelectorAll<HTMLElement>('[data-message-id]')).find(node => node.getBoundingClientRect().bottom > windowViewport.getBoundingClientRect().top)!
    const beforeId = beforeNode.dataset.messageId!
    const beforeOffset = beforeNode.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top
    await settle()
    if (windowViewport.firstElementChild!.getAttribute('data-message-id') === oldFirst) throw Error('History window waits until the top instead of preloading')
    const afterNode = windowViewport.querySelector<HTMLElement>(`[data-message-id="${beforeId}"]`)!
    expectNear(afterNode.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top, beforeOffset, 'Preloading retains the actual visible anchor offset')
    for (let i = 0; i < 45 && olderLoads === 0; i++) {
      windowViewport.scrollTop = 100
      await settle()
      windowViewport.scrollTop = 0
      await settle()
    }
    if (olderLoads === 0) throw Error('Loaded history top never requested disk pagination')
    passed.push('ordinary top scrolling shifts windows with anchor preservation and requests older history')
    windowViewport.dispatchEvent(new Event(AutoScrollSuspendEventName))
    windowViewport.scrollTop = 1200
    await settle()
    const visibleBefore = Array.from(windowViewport.querySelectorAll<HTMLElement>('[data-message-id]')).find(node => node.getBoundingClientRect().bottom > windowViewport.getBoundingClientRect().top)!
    const anchorId = visibleBefore.dataset.messageId!
    const offsetBefore = visibleBefore.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top
    const prefix: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({ ...historyMessages[i], id: `older-${i}` }))
    root.render(<WindowHarness generation={1} entries={[...prefix, ...historyMessages]} />)
    await settle()
    const retained = windowViewport.querySelector<HTMLElement>(`[data-message-id="${anchorId}"]`)
    if (!retained) throw Error('Prepending history discarded the visible message')
    expectNear(retained.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top, offsetBefore, 'Prepending history preserves message identity and viewport offset')
    passed.push('combined window and auto-follow preserve the reading anchor after history prepend')
    const beforeEnd = windowViewport.lastElementChild!.getAttribute('data-message-id')
    windowViewport.scrollTop = windowViewport.scrollHeight - windowViewport.clientHeight - 100
    const downAnchor = Array.from(windowViewport.querySelectorAll<HTMLElement>('[data-message-id]')).find(node => node.getBoundingClientRect().bottom > windowViewport.getBoundingClientRect().top)!
    const downId = downAnchor.dataset.messageId!
    const downOffset = downAnchor.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top
    await settle()
    if (windowViewport.lastElementChild!.getAttribute('data-message-id') === beforeEnd) throw Error('Downward scrolling failed to load the next window')
    const downAfter = windowViewport.querySelector<HTMLElement>(`[data-message-id="${downId}"]`)!
    expectNear(downAfter.getBoundingClientRect().top - windowViewport.getBoundingClientRect().top, downOffset, 'Downward window shift preserves the reading anchor')
    passed.push('downward preloading extends the window without jumping to the conversation end')
    const firstBeforePrepend = windowViewport.firstElementChild!.getAttribute('data-message-id')
    const extraPrefix = prefix.map(message => ({ ...message, id: `extra-${message.id}` }))
    root.render(<WindowHarness generation={1} entries={[...extraPrefix, ...prefix, ...historyMessages]} />)
    await settle()
    if (windowViewport.firstElementChild!.getAttribute('data-message-id') !== firstBeforePrepend) throw Error('History prepend shifted the fixed window to a different message identity')
    passed.push('fixed window start is stable by message identity after prepend')
    return passed
  },
})
