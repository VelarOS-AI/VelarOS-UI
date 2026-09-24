import { memo, type ReactElement, type ReactNode, useLayoutEffect } from 'react'

import { StyleUtils } from '@velaros-ai/ui'

import styles from './MessageBubble.module.css'

import type { ScriptExecutionBlock, ToolCallBlock as ToolCallBlockType } from '#contracts'
import { isBlank, isPresent, isString } from '#internal/runtime'

const cx = StyleUtils.bindCx(styles)
const MaxRememberedToolActivityMotions = 1_200
const ToolActivityMotionRevisionByKey = new Map<string, string>()

function rememberToolActivityMotionRevision(key: string, revision: string): void {
  if (ToolActivityMotionRevisionByKey.has(key)) {
    ToolActivityMotionRevisionByKey.delete(key)
  } else if (ToolActivityMotionRevisionByKey.size >= MaxRememberedToolActivityMotions) {
    const oldestKey = ToolActivityMotionRevisionByKey.keys().next().value
    if (isString(oldestKey)) ToolActivityMotionRevisionByKey.delete(oldestKey)
  }

  ToolActivityMotionRevisionByKey.set(key, revision)
}

function getToolActivityMotionPhase(block: ToolCallBlockType): string {
  if (block.isRunning) {
    if (isPresent(block.progress) && !isBlank(block.progress)) return 'running-progress'
    if (isPresent(block.metadata)) return 'running-metadata'
    return 'running'
  }

  if (isPresent(block.error) && !isBlank(block.error)) return 'error'
  if (isPresent(block.result)) return 'complete'
  return 'settled'
}

/**
 * 只描述会改变卡片视觉语义的阶段，不把每条 progress 文本都变成一次动画。
 * 传一组时逐个拼接：组里任一成员换了阶段或多了成员，都表现为一次“更新”而不是整卡重新入场。
 */
export function getToolActivityMotionRevision(blocks: readonly ToolCallBlockType[]): string {
  return blocks.map((block) => `${block.toolCallId}:${getToolActivityMotionPhase(block)}`).join('|')
}

export function resolveToolActivityMotionKind({
  isStreaming,
  previousRevision,
  revision,
}: {
  isStreaming: boolean
  previousRevision?: string
  revision: string
}): 'enter' | 'none' | 'update' {
  if (!isStreaming) return 'none'
  if (!isPresent(previousRevision)) return 'enter'
  return previousRevision === revision ? 'none' : 'update'
}

/** 脚本执行卡的视觉阶段就是它的状态：编写、运行、落定各一次，追加调用不算更新。 */
export function getScriptExecutionMotionRevision(
  block: Pick<ScriptExecutionBlock, 'id' | 'status'>
): string {
  return `${block.id}:${block.status}`
}

function ToolActivityMotionInner({
  activityKey,
  revision,
  children,
  isStreaming,
  messageId,
  sessionId,
}: {
  activityKey: string
  /** 卡片的视觉阶段：变了才播一次更新脉冲（见 `getToolActivityMotionRevision`）。 */
  revision: string
  children: ReactNode
  isStreaming: boolean
  messageId: string
  sessionId: string
}): ReactElement {
  const registryKey = `${sessionId}:${messageId}:${activityKey}`
  const previousRevision = ToolActivityMotionRevisionByKey.get(registryKey)
  const motionKind = resolveToolActivityMotionKind({
    isStreaming,
    previousRevision,
    revision,
  })

  useLayoutEffect(() => {
    rememberToolActivityMotionRevision(registryKey, revision)
  }, [registryKey, revision])

  return (
    <div
      className={cx('toolActivityMotion', motionKind === 'enter' && 'toolActivityMotionEnter')}
      data-tool-activity-motion={motionKind}
    >
      {children}
      {motionKind === 'update' && (
        <span key={revision} className={styles.toolActivityMotionUpdatePulse} aria-hidden="true" />
      )}
    </div>
  )
}

export const ToolActivityMotion = memo(ToolActivityMotionInner)
ToolActivityMotion.displayName = 'ToolActivityMotion'
