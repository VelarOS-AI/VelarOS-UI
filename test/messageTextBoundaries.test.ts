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

test('groups narrated progress in order before the final answer', () => {
  const narration = text('我先做一次只读扫描。', 'turn-1', 'segment-1')
  const answer = text('我做了只读扫描。', 'turn-2', 'segment-2')
  const original = message([thinking, script, narration, { ...script, id: 'script-2' }, answer])
  const visible = getVisibleMessageBlocks(original, true)
  expect(visible).toEqual(original.blocks)
  const segments = buildMessageRenderSegments(buildToolRenderSegments(visible))
  const partition = partitionProcessedActivitySummarySegments(
    segments,
    getProcessedActivitySummaryBoundaryIndex(segments)
  )
  expect(partition.leadingSegments).toEqual([])
  expect(partition.processedSegments).toEqual(segments.slice(0, 3))
  expect(partition.trailingSegments).toEqual(segments.slice(3))
  expect(original.blocks).toHaveLength(5)
})

test('shows processed at the start and leaves all final paragraphs visible', () => {
  const segments = buildMessageRenderSegments(buildToolRenderSegments([
    script,
    text('构建已经完成。', 'turn-2', 'progress'),
    text('这是最终结果。', 'turn-3', 'answer'),
    text('这些是核验项。', 'turn-3', 'verification'),
  ]))
  const partition = partitionProcessedActivitySummarySegments(
    segments,
    getProcessedActivitySummaryBoundaryIndex(segments)
  )
  expect(partition.leadingSegments).toEqual([])
  expect(partition.processedSegments).toEqual(segments.slice(0, 2))
  expect(partition.trailingSegments).toEqual(segments.slice(2))
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

test('empty thinking placeholders never create an activity disclosure', () => {
  for (const value of ['', '  \n ']) {
    const blocks: ContentBlock[] = [{ type: 'thinking', text: value }]
    expect(buildMessageRenderSegments(buildToolRenderSegments(blocks))).toEqual([])
    expect(blocks).toHaveLength(1)
  }
})

test('empty thinking between real steps does not remove or split execution records', () => {
  const blocks: ContentBlock[] = [thinking, { type: 'thinking', text: '' }, script]
  const segments = buildMessageRenderSegments(buildToolRenderSegments(blocks))
  expect(segments).toHaveLength(1)
  expect(segments[0].kind).toBe('activity-group')
  if (segments[0].kind === 'activity-group') {
    expect(segments[0].segments.map(({ block }) => block)).toEqual([thinking, script])
    expect(segments[0].blocks).toEqual([script])
  }
})
