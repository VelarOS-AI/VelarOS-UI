import React from 'react'
import { createRoot } from 'react-dom/client'

import type { ActiveContextArtifact, ChatMessage } from '../../src/conversation/contracts'
import { ConversationLocalizationProvider } from '../../src/conversation/i18n'
import type { ConversationActionPort, ConversationGoalLifecycleResult } from '../../src/conversation/shell/conversationActionPort'
import { useGoalDock } from '../../src/conversation/shell/useGoalDock'

type Reply = { sessionId: string; resolve: (result: ConversationGoalLifecycleResult) => void }
const reads: Reply[] = []
const updates: Reply[] = []
const continuations: string[] = []
const guidance: string[] = []
const emptyMessages: ChatMessage[] = []
const scene = { sessionId: 'a', running: false }
const actionPort: ConversationActionPort = {
  getGoalLifecycle: (sessionId) => new Promise((resolve) => { reads.push({ sessionId, resolve }) }),
  updateGoalLifecycle: (sessionId) => new Promise((resolve) => { updates.push({ sessionId, resolve }) }),
  provideExecutionGuidance: async (sessionId) => { guidance.push(sessionId) },
  resolveHandoffSuggestion: () => undefined,
}
const root = createRoot(document.getElementById('root')!)
function Harness(): React.ReactElement {
  const sessionId = scene.sessionId
  const control = useGoalDock({ sessionId, actionPort, messages: emptyMessages,
    runtime: { status: scene.running ? 'running' : 'idle', lastRunFinishedAt: null },
    isRunActive: scene.running, onContinueGoal: () => { continuations.push(sessionId) },
  })
  return <><output id="goal">{control.goalLifecycleArtifact?.content ?? ''}</output>
    <output id="busy">{String(control.goalLifecycleBusy)}</output>
    <button id="pause" disabled={control.goalLifecycleBusy} onClick={() => { void control.handleGoalLifecycleAction('pause') }}>Pause</button>
    <button id="continue" disabled={control.goalLifecycleBusy} onClick={() => { void control.handleContinueGoal() }}>Continue</button>
  </>
}
async function settle(): Promise<void> { for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame) }
async function render(next: Partial<typeof scene>): Promise<void> {
  Object.assign(scene, next)
  root.render(<ConversationLocalizationProvider value={{ locale: 'en-US', t: (key: string) => key }}><Harness /></ConversationLocalizationProvider>)
  await settle()
}
function artifact(sessionId: string, content: string): ActiveContextArtifact {
  return { id: `goal-${sessionId}`, kind: 'plan', scope: 'session', status: 'active', sessionId,
    title: 'Goal', content, metadata: { goalStatus: 'active' }, createdAt: 1, updatedAt: 2 }
}
async function reply(queue: Reply[], sessionId: string, content: string | null, ok = true): Promise<void> {
  const index = queue.findIndex((pending) => pending.sessionId === sessionId)
  if (index < 0) throw Error(`Missing ${sessionId} pending reply`)
  queue.splice(index, 1)[0].resolve({ ok, goal: content ? artifact(sessionId, content) : null })
  await settle()
}
function text(id: string): string { return document.getElementById(id)!.textContent! }
function expect(condition: boolean, message: string): void { if (!condition) throw Error(message) }
async function click(id: string): Promise<void> { document.getElementById(id)!.click(); await settle() }

Object.assign(window, {
  async runGoalDockRegression(): Promise<string[]> {
    await render({ sessionId: 'a' })
    await render({ sessionId: 'b' })
    await reply(reads, 'a', 'old read a')
    expect(text('goal') === '', 'A late old read must not enter the new session')
    await reply(reads, 'b', 'goal b')
    await render({ sessionId: 'a' })
    expect(text('goal') === '', 'Switching must immediately remove the previous displayed goal')
    await reply(reads, 'a', 'goal a')
    await click('continue')
    await render({ sessionId: 'b' })
    expect(text('busy') === 'false' && text('goal') === '', 'A new session must own fresh presentation state')
    await reply(reads, 'b', 'new goal b')
    await click('pause')
    await reply(updates, 'a', 'resumed old a')
    expect(text('goal') === 'new goal b' && text('busy') === 'true', 'An old update and finally must neither replace the goal nor release a new action')
    expect(continuations.length === 0 && guidance.length === 0, 'A stale resume must not deliver a follow-up action')
    await reply(updates, 'b', 'paused b')
    expect(text('busy') === 'false' && text('goal') === 'paused b', 'The current action must still complete normally')

    await render({ sessionId: 'a' })
    await reply(reads, 'a', 'second a')
    await click('pause')
    await render({ sessionId: 'b' })
    await reply(reads, 'b', 'second b')
    await render({ sessionId: 'a' })
    await reply(reads, 'a', 'reopened a')
    await reply(updates, 'a', 'stale second a')
    expect(text('goal') === 'reopened a', 'Returning to the same session id must not revive an older mounted scope')
    await click('continue')
    root.render(<div />)
    await settle()
    await reply(updates, 'a', 'unmounted a')
    expect(continuations.length === 0, 'An unmounted resume must not call the old host callback')

    await render({ sessionId: 'b' })
    await reply(reads, 'b', 'retained b')
    await click('pause')
    await reply(updates, 'b', null, false)
    expect(text('goal') === 'retained b', 'A soft action failure must preserve the current goal while refreshing')
    await reply(reads, 'b', null, false)
    expect(text('goal') === 'retained b' && text('busy') === 'false', 'A soft read failure must preserve the goal and finish the action')
    await click('continue')
    await reply(updates, 'b', 'resumed b')
    expect(continuations.join() === 'b', 'A current idle resume must still call its host continuation')
    await render({ running: true })
    await reply(reads, 'b', 'running b')
    await click('continue')
    await reply(updates, 'b', 'running resumed b')
    expect(guidance.join() === 'b' && continuations.length === 1, 'A current running resume must still use execution guidance')
    root.unmount()
    return ['late reads, updates and busy cleanup remain session-owned', 'A to B to A and unmount reject stale continuations', 'soft failure preservation and current idle/running resume']
  },
})
