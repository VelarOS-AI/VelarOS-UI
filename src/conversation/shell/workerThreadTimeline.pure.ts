import type { ConversationWorkerThread } from '../projection'

import type { ChatMessage } from '#contracts'
import { isConversationTurnInputMessage } from '#contracts'
import { toNullable } from '#internal/runtime'

interface WorkerThreadMessageAnchor {
  timestamp: number
  order: number
  messageId: string
  role: ChatMessage['role']
  isTurnInput: boolean
}

interface WorkerThreadTranscriptAnchorIndex {
  scriptIds: ReadonlySet<string>
  messageAnchors: WorkerThreadMessageAnchor[]
}

export interface WorkerThreadTranscriptPlacement {
  beforeTranscript: ConversationWorkerThread[]
  afterMessageId: Map<string, ConversationWorkerThread[]>
  /** 按派发脚本卡的稳定身份挂载线程。 */
  afterStepId: Map<string, ConversationWorkerThread[]>
}

function sortWorkerThreadsByStartTime(
  threads: readonly ConversationWorkerThread[]
): ConversationWorkerThread[] {
  return [...threads].sort((left, right) => {
    const timestampDelta = left.startedAt - right.startedAt
    return timestampDelta !== 0 ? timestampDelta : left.threadId.localeCompare(right.threadId)
  })
}

function createWorkerThreadTranscriptAnchorIndex(
  messages: readonly ChatMessage[]
): WorkerThreadTranscriptAnchorIndex {
  const scriptIds = new Set<string>()
  const messageAnchors = messages.map((message, order): WorkerThreadMessageAnchor => {
    for (const block of message.blocks)
      if (block.type === 'script-execution') scriptIds.add(block.id)
    return {
      messageId: message.id,
      role: message.role,
      isTurnInput: isConversationTurnInputMessage(message),
      timestamp: message.timestamp,
      order,
    }
  })
  messageAnchors.sort((left, right) => left.timestamp - right.timestamp || left.order - right.order)
  return { scriptIds, messageAnchors }
}

function findAnchorAtOrBefore(
  anchors: readonly WorkerThreadMessageAnchor[],
  timestamp: number
): Nullable<WorkerThreadMessageAnchor> {
  let low = 0
  let high = anchors.length - 1
  let anchor: Nullable<WorkerThreadMessageAnchor> = null
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const middleAnchor = anchors[middle]!
    if (middleAnchor.timestamp <= timestamp) {
      anchor = middleAnchor
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return anchor
}

function findWorkerThreadAnchorMessageId(
  anchorIndex: WorkerThreadTranscriptAnchorIndex,
  thread: ConversationWorkerThread
): Nullable<string> {
  const anchor = findAnchorAtOrBefore(anchorIndex.messageAnchors, thread.startedAt)
  if (!anchor || anchor.role === 'assistant') return toNullable(anchor?.messageId)

  // 线程可能先于本轮第一条助手消息出现；助手到达后归入本轮，不跨越下一条用户输入。
  for (const next of anchorIndex.messageAnchors) {
    if (next.order <= anchor.order) continue
    if (next.isTurnInput) break
    if (next.role === 'assistant') return next.messageId
  }
  return anchor.messageId
}

/** 优先挂到宿主声明的脚本卡；卡片缺席或在分页窗外时，按本轮消息时间落位。 */
export function groupWorkerThreadsByTranscriptAnchor(
  messages: readonly ChatMessage[],
  threads: readonly ConversationWorkerThread[]
): WorkerThreadTranscriptPlacement {
  const beforeTranscript: ConversationWorkerThread[] = []
  const afterMessageId = new Map<string, ConversationWorkerThread[]>()
  const afterStepId = new Map<string, ConversationWorkerThread[]>()
  const anchorIndex = createWorkerThreadTranscriptAnchorIndex(messages)

  for (const thread of sortWorkerThreadsByStartTime(threads)) {
    const stepId =
      thread.anchorId && anchorIndex.scriptIds.has(thread.anchorId) ? thread.anchorId : null
    const anchorId = stepId ?? findWorkerThreadAnchorMessageId(anchorIndex, thread)
    if (!anchorId) {
      beforeTranscript.push(thread)
      continue
    }
    const anchoredThreads = stepId ? afterStepId : afterMessageId
    const group = anchoredThreads.get(anchorId)
    if (group) group.push(thread)
    else anchoredThreads.set(anchorId, [thread])
  }

  return { beforeTranscript, afterMessageId, afterStepId }
}

/** 相同锚点下的线程引用未变时，正文增量不触发线程面板重画。 */
export function isSameWorkerThreadPlacement(
  left: WorkerThreadTranscriptPlacement,
  right: WorkerThreadTranscriptPlacement
): boolean {
  return (
    isSameThreadList(left.beforeTranscript, right.beforeTranscript) &&
    isSameThreadMap(left.afterMessageId, right.afterMessageId) &&
    isSameThreadMap(left.afterStepId, right.afterStepId)
  )
}

function isSameThreadList(
  left: readonly ConversationWorkerThread[],
  right: readonly ConversationWorkerThread[]
): boolean {
  return left.length === right.length && left.every((thread, index) => thread === right[index])
}

function isSameThreadMap(
  left: ReadonlyMap<string, readonly ConversationWorkerThread[]>,
  right: ReadonlyMap<string, readonly ConversationWorkerThread[]>
): boolean {
  if (left.size !== right.size) return false
  for (const [key, threads] of left) {
    const other = right.get(key)
    if (!other || !isSameThreadList(threads, other)) return false
  }
  return true
}

export function listWorkerThreadsFromTranscriptPlacement(
  placement: WorkerThreadTranscriptPlacement
): ConversationWorkerThread[] {
  const byThreadId = new Map<string, ConversationWorkerThread>()
  const appendThreads = (threads: readonly ConversationWorkerThread[]): void => {
    for (const thread of threads)
      if (!byThreadId.has(thread.threadId)) byThreadId.set(thread.threadId, thread)
  }

  appendThreads(placement.beforeTranscript)
  for (const threads of placement.afterMessageId.values()) appendThreads(threads)
  for (const threads of placement.afterStepId.values()) appendThreads(threads)
  return sortWorkerThreadsByStartTime([...byThreadId.values()])
}
