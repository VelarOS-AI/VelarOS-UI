import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildMessageRenderSegments, getVisibleMessageBlocks } from '../src/conversation/blocks/messageBubbleRenderModel'
import type { ChatMessage } from '../src/conversation/contracts'

void test('思考和执行共用一个过程组且保持顺序和正文边界', () => {
  const blocks: ChatMessage['blocks'] = [
    { type: 'thinking', text: 'first' },
    { type: 'tool-call', toolCallId: 'call', toolName: 'read', args: {}, isRunning: false },
    { type: 'thinking', text: 'second' },
    { type: 'text', text: 'answer' },
  ]
  const segments = blocks.map((block, index) => ({ key: String(index), block }))
  const grouped = buildMessageRenderSegments(segments)
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].kind, 'activity-group')
  if (grouped[0].kind !== 'activity-group') throw Error('missing group')
  assert.deepEqual(grouped[0].segments.map(item => item.block), blocks.slice(0, 3))
  assert.equal(grouped[0].blocks.length, 1)
  assert.equal(grouped[1].kind, 'segment')
  assert.equal(buildMessageRenderSegments(segments.slice(0, 1))[0].key, grouped[0].key)
})

void test('关闭思考只过滤思考条目，不删除执行及原始数据', () => {
  const message: ChatMessage = { id: 'm', role: 'assistant', timestamp: 1, blocks: [{ type: 'thinking', text: 'hidden' }, { type: 'text', text: 'answer' }] }
  const visible = getVisibleMessageBlocks(message, false, { showThinkingProcess: false })
  assert.equal(visible.some(block => block.type === 'thinking'), false)
  assert.equal(message.blocks.length, 2)
})
