import type { ContentBlock, ToolCallBlock as ToolCallBlockType } from '#contracts'
import { isPresent } from '#internal/runtime'

export const TOOL_ACTIVITY_SUMMARY_EXCLUDED_TOOL_NAMES = ['ui:show_widget', 'plan:update'] as const
export const TOOL_ACTIVITY_SUMMARY_INTERACTION_TOOL_NAMES = [
  'interaction:show_action_cards',
  'interaction:confirm',
] as const

export const ToolActivitySummaryExcludedToolNameSet = new Set<string>(
  TOOL_ACTIVITY_SUMMARY_EXCLUDED_TOOL_NAMES
)
const ToolActivitySummaryInteractionToolNameSet = new Set<string>(
  TOOL_ACTIVITY_SUMMARY_INTERACTION_TOOL_NAMES
)

/** 同名工具调用的一组（`getMergedCommandCopyValue` 的入参形状）。 */
export interface MergedToolCallGroup {
  key: string
  toolName: string
  blocks: ToolCallBlockType[]
  representative: ToolCallBlockType
}

/**
 * 消息渲染的最小单元：一个内容块一段，`key` 是它在消息里的稳定身份。
 * 工具调用各占一段、按发生顺序排，不再按工具名归并成「×N」行或工具组；`kind` 因此恒为 `'block'`，
 * 留着是给还在按 `kind` 判别的宿主。
 */
export interface ToolRenderSegment {
  kind: 'block'
  block: ContentBlock
  key: string
}

export type ToolActivitySummaryExclusionPredicate = (
  block: Pick<ToolCallBlockType, 'toolName' | 'isRunning' | 'error' | 'toolCallId'>
) => boolean

export function isToolActivitySummaryExcludedToolCall(
  block: Pick<ToolCallBlockType, 'toolName' | 'isRunning' | 'error'>
): boolean {
  if (ToolActivitySummaryInteractionToolNameSet.has(block.toolName)) return true
  if (!block.isRunning && isPresent(block.error)) return false

  return ToolActivitySummaryExcludedToolNameSet.has(block.toolName)
}

/** 块在消息里的稳定身份：有自己 id 的块用 id，其余按位置。 */
function getBlockSegmentKey(block: ContentBlock, index: number): string {
  switch (block.type) {
    case 'tool-call':
      return `tool:${block.toolCallId}`
    case 'script-execution':
      return `script:${block.id}`
    case 'thinking':
      return `thinking:${index}`
    case 'user-action-card':
      return `user-action-card:${block.card.id}`
    default:
      return `text:${index}`
  }
}

export function buildToolRenderSegments(blocks: readonly ContentBlock[]): ToolRenderSegment[] {
  return blocks.map((block, index) => ({
    kind: 'block',
    block,
    key: getBlockSegmentKey(block, index),
  }))
}
