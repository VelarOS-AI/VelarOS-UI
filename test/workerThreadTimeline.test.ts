import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { ChatMessage } from '../src/conversation/contracts'
import type { ConversationWorkerThread } from '../src/conversation/projection'
import {
  groupWorkerThreadsByTranscriptAnchor,
  isSameWorkerThreadPlacement,
  listWorkerThreadsFromTranscriptPlacement,
} from '../src/conversation/shell/workerThreadTimeline.pure'

function script(id: string): Extract<ChatMessage['blocks'][number], { type: 'script-execution' }> {
  return {
    type: 'script-execution',
    id,
    kind: 'execute',
    title: '派一个子任务',
    status: 'succeeded',
    source: '',
    sourceTruncated: false,
    calls: [],
    durationMs: 12,
  }
}

function workerThread(
  threadId: string,
  options: { startedAt: number; anchorId?: string }
): ConversationWorkerThread {
  return {
    threadId,
    ...options,
    title: 'Review the patch',
    agentName: 'Scout',
    phase: 'researching',
    status: 'running',
    subagentType: 'explore',
    model: 'provider/model',
    updatedAt: options.startedAt,
    input: 'Review the patch',
    output: null,
    error: null,
    messages: [],
  }
}

void describe('worker thread transcript placement', () => {
  void test('explicit script anchors take priority over the thread timestamp', () => {
    const message: ChatMessage = {
      id: 'conversation:run:run-1',
      role: 'assistant',
      blocks: [script('card-1'), script('card-2')],
      timestamp: 500,
    }
    const first = workerThread('job-a', { startedAt: 400, anchorId: 'card-1' })
    const second = workerThread('job-b', {
      startedAt: 600,
      anchorId: 'card-2',
    })
    const missing = workerThread('job-gone', {
      startedAt: 600,
      anchorId: 'card-missing',
    })
    const placement = groupWorkerThreadsByTranscriptAnchor([message], [second, first, missing])

    assert.deepEqual(placement.afterStepId.get('card-1'), [first])
    assert.deepEqual(placement.afterStepId.get('card-2'), [second])
    assert.deepEqual(placement.afterMessageId.get(message.id), [missing])
  })

  void test('two activations of one named agent retain their unique thread and script identities', () => {
    const messages: ChatMessage[] = [
      {
        id: 'first-run',
        role: 'assistant',
        blocks: [script('first-card')],
        timestamp: 1_000,
      },
      {
        id: 'next-run',
        role: 'assistant',
        blocks: [script('resume-card')],
        timestamp: 2_000,
      },
    ]
    const first = workerThread('conversation:agent:run-1:agent-1:0', {
      startedAt: 998,
      anchorId: 'first-card',
    })
    const resumed = workerThread('conversation:agent:run-2:agent-1:0', {
      startedAt: 1_998,
      anchorId: 'resume-card',
    })
    const placement = groupWorkerThreadsByTranscriptAnchor(messages, [resumed, first])

    assert.deepEqual(placement.afterStepId.get('first-card'), [first])
    assert.deepEqual(placement.afterStepId.get('resume-card'), [resumed])
    assert.deepEqual(listWorkerThreadsFromTranscriptPlacement(placement), [first, resumed])
    assert.equal(first.agentName, resumed.agentName)
  })

  void test('tool arguments and results neither invent a thread nor claim a script anchor', () => {
    const message: ChatMessage = {
      id: 'assistant',
      role: 'assistant',
      timestamp: 500,
      blocks: [
        {
          type: 'tool-call',
          toolCallId: 'tool-call',
          toolName: 'custom:delegate',
          args: { thread_id: 'agent-1', prompt: 'Review the patch' },
          result:
            '<subagent-result type="application/json">{"thread_id":"agent-1"}</subagent-result>',
          isRunning: true,
          startedAt: 500,
        },
      ],
    }
    const empty = groupWorkerThreadsByTranscriptAnchor([message], [])
    assert.deepEqual(listWorkerThreadsFromTranscriptPlacement(empty), [])

    const thread = workerThread('agent-1', {
      startedAt: 600,
      anchorId: 'tool-call',
    })
    const placement = groupWorkerThreadsByTranscriptAnchor([message], [thread])
    assert.equal(placement.afterStepId.size, 0)
    assert.deepEqual(placement.afterMessageId.get(message.id), [thread])
  })

  void test('threads before the loaded window stay visible before its transcript', () => {
    const message: ChatMessage = {
      id: 'tail',
      role: 'assistant',
      blocks: [],
      timestamp: 1_000,
    }
    const first = workerThread('job-a', {
      startedAt: 500,
      anchorId: 'outside-window',
    })
    const second = workerThread('job-b', { startedAt: 500 })
    const placement = groupWorkerThreadsByTranscriptAnchor([message], [second, first])

    assert.deepEqual(placement.beforeTranscript, [first, second])
    assert.deepEqual(listWorkerThreadsFromTranscriptPlacement(placement), [first, second])
    assert.deepEqual(groupWorkerThreadsByTranscriptAnchor([], [first]).beforeTranscript, [first])
  })

  void test('a thread that precedes its first assistant message joins that run activity', () => {
    const thread = workerThread('subagent:early', { startedAt: 550 })
    const messages: ChatMessage[] = [
      {
        id: 'user',
        role: 'user',
        conversationKind: 'turn-input',
        blocks: [],
        timestamp: 500,
      },
      { id: 'assistant', role: 'assistant', blocks: [], timestamp: 600 },
    ]
    const placement = groupWorkerThreadsByTranscriptAnchor(messages, [thread])

    assert.equal(placement.afterMessageId.has('user'), false)
    assert.deepEqual(placement.afterMessageId.get('assistant'), [thread])
  })

  void test('a missing assistant anchor never moves the thread into the next user turn', () => {
    const thread = workerThread('subagent:previous', { startedAt: 550 })
    const messages: ChatMessage[] = [
      {
        id: 'user',
        role: 'user',
        conversationKind: 'turn-input',
        blocks: [],
        timestamp: 500,
      },
      {
        id: 'next-user',
        role: 'user',
        conversationKind: 'turn-input',
        blocks: [],
        timestamp: 700,
      },
      { id: 'next-assistant', role: 'assistant', blocks: [], timestamp: 800 },
    ]
    const placement = groupWorkerThreadsByTranscriptAnchor(messages, [thread])

    assert.deepEqual(placement.afterMessageId.get('user'), [thread])
    assert.equal(placement.afterMessageId.has('next-assistant'), false)
  })

  void test('streamed text alone leaves placement and thread references equal', () => {
    const card = script('card')
    const thread = workerThread('agent', { startedAt: 501, anchorId: card.id })
    const message: ChatMessage = {
      id: 'message',
      role: 'assistant',
      blocks: [card, { type: 'text', text: 'wor' }],
      timestamp: 500,
    }
    const before = groupWorkerThreadsByTranscriptAnchor([message], [thread])
    const after = groupWorkerThreadsByTranscriptAnchor(
      [{ ...message, blocks: [card, { type: 'text', text: 'working' }] }],
      [thread]
    )

    assert.equal(isSameWorkerThreadPlacement(before, after), true)
    assert.strictEqual(before.afterStepId.get(card.id)?.[0], after.afterStepId.get(card.id)?.[0])
  })

  void test('a changed thread or anchor makes the placement differ', () => {
    const message: ChatMessage = {
      id: 'message',
      role: 'assistant',
      blocks: [script('card')],
      timestamp: 500,
    }
    const thread = workerThread('agent', { startedAt: 501, anchorId: 'card' })
    const before = groupWorkerThreadsByTranscriptAnchor([message], [thread])

    assert.equal(
      isSameWorkerThreadPlacement(
        before,
        groupWorkerThreadsByTranscriptAnchor([message], [{ ...thread, output: 'More' }])
      ),
      false
    )
    assert.equal(
      isSameWorkerThreadPlacement(
        before,
        groupWorkerThreadsByTranscriptAnchor([{ ...message, blocks: [] }], [thread])
      ),
      false
    )
  })
})
