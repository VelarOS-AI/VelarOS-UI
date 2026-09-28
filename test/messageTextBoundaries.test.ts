import { expect, test } from 'bun:test'

import {
  buildMessageRenderSegments,
  getProcessedActivitySummaryBoundaryIndex,
  getVisibleMessageBlocks,
  partitionProcessedActivitySummarySegments,
} from '../src/conversation/blocks/messageBubbleRenderModel'
import type { ChatMessage, ContentBlock, TextBlock } from '../src/conversation/contracts'
import { buildToolRenderSegments } from '../src/conversation/tool-render/toolCallRenderGrouping'

const text = (value: string, turnId?: string, segmentId?: string): TextBlock => ({
  type: 'text',
  text: value,
  turnId,
  segmentId,
})
const message = (blocks: ContentBlock[]): ChatMessage => ({
  id: 'run',
  role: 'assistant',
  timestamp: 1,
  blocks,
})
const thinking: ContentBlock = { type: 'thinking', text: '考虑下一步' }
const script: ContentBlock = {
  type: 'script-execution',
  id: 'script-1',
  kind: 'execute',
  title: '扫描磁盘可清理项',
  status: 'succeeded',
  source: '',
  sourceTruncated: false,
  calls: [],
  durationMs: 10,
}

test('keeps the previous turn narration inside processed activity and the final answer separate', () => {
  // 模型先输出程序，再输出这轮旁白；下一轮接着回答，中间可以没有思考块。
  const narration = text('我先做一次只读扫描。', 'turn-1', 'segment-1')
  const answer = text('我做了只读扫描。', 'turn-2', 'segment-2')
  const original = message([thinking, script, narration, answer])
  const visible = getVisibleMessageBlocks(original, true)
  expect(visible).toEqual(original.blocks)
  const segments = buildMessageRenderSegments(buildToolRenderSegments(visible))
  const partition = partitionProcessedActivitySummarySegments(
    segments,
    getProcessedActivitySummaryBoundaryIndex(segments)
  )
  expect(partition.processedSegments).toEqual(segments.slice(0, 3))
  expect(partition.trailingSegments).toEqual(segments.slice(3))
  expect(original.blocks).toHaveLength(4)
})

test('retains turn boundaries with thinking and tool details hidden', () => {
  const narration = text('前一轮', 'turn-1')
  const answer = text('后一轮', 'turn-2')
  const original = message([narration, script, thinking, answer])
  expect(getVisibleMessageBlocks(original, false, { showThinkingProcess: false })).toEqual([
    narration,
    answer,
  ])
  expect(getVisibleMessageBlocks(message([narration, thinking, answer]), true)).toEqual([
    narration,
    thinking,
    answer,
  ])
})

test('keeps separate segments in one turn and identified text beside legacy text', () => {
  for (const blocks of [
    [text('第一段', 'turn-1', 'segment-1'), text('第二段', 'turn-1', 'segment-2')],
    [text('旧正文'), text('新正文', 'turn-1', 'segment-1')],
  ]) {
    expect(getVisibleMessageBlocks(message(blocks), true)).toEqual(blocks)
  }
})

test('still joins fragments of the same segment and legacy fragments across thinking', () => {
  for (const identity of [[], ['turn-1', 'segment-1']] as const) {
    const first = text('**Hello', identity[0], identity[1])
    const last = text(' world**', identity[0], identity[1])
    expect(getVisibleMessageBlocks(message([first, thinking, last]), true)).toEqual([
      { ...first, text: '**Hello world**' },
      thinking,
    ])
  }
})

test('keeps error text separate even when its segment matches', () => {
  const blocks = [text('正文', 'turn-1', 'segment-1'), {
    ...text('错误', 'turn-1', 'segment-1'), tone: 'error' as const,
  }]
  expect(getVisibleMessageBlocks(message(blocks), true)).toEqual(blocks)
})
