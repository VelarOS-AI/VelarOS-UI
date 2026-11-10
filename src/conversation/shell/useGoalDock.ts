/** 目标坞的显示与异步动作归属；宿主持有目标事实，旧会话回执不更新当前坞或继续投递。 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useConversationI18n } from '../i18n'
import type { ConversationRuntimeView } from '../projection'

import type { ConversationActionPort } from './conversationActionPort'
import { getGoalLifecycleRefreshKey } from './currentTurnToolBlocks'

import type { ActiveContextArtifact, ChatGoalLifecycleAction, ChatMessage } from '#contracts'
import { Log } from '#internal/runtime'

const log = Log.tag('goal-dock')
interface GoalDockScope { sessionId: string; actionPort: ConversationActionPort }
interface GoalDockState { scope: GoalDockScope; artifact: Nullable<ActiveContextArtifact>; busy: boolean }
interface GoalDockControl {
  goalLifecycleArtifact: Nullable<ActiveContextArtifact>
  goalLifecycleBusy: boolean
  handleGoalLifecycleAction: (action: ChatGoalLifecycleAction) => Promise<boolean>
  handleContinueGoal: () => Promise<void>
}

export function useGoalDock({ sessionId, actionPort, messages, runtime, isRunActive, onContinueGoal }: {
  sessionId: string
  actionPort: ConversationActionPort
  messages: ChatMessage[]
  runtime: Pick<ConversationRuntimeView, 'status' | 'lastRunFinishedAt'>
  isRunActive: boolean
  onContinueGoal?: (input: string) => unknown | Promise<unknown>
}): GoalDockControl {
  const { t } = useConversationI18n()
  const scope = useMemo<GoalDockScope>(() => ({ sessionId, actionPort }), [actionPort, sessionId])
  const activeScopeRef = useRef<Nullable<GoalDockScope>>(null)
  const [state, setState] = useState<GoalDockState>(() => ({ scope, artifact: null, busy: false }))
  if (state.scope !== scope) setState({ scope, artifact: null, busy: false })
  const goalLifecycleArtifact = state.scope === scope ? state.artifact : null
  const goalLifecycleBusy = state.scope === scope && state.busy

  useLayoutEffect(() => {
    activeScopeRef.current = scope
    return () => { if (activeScopeRef.current === scope) activeScopeRef.current = null }
  }, [scope])
  const isCurrent = useCallback(() => activeScopeRef.current === scope, [scope])
  const applyGoal = useCallback((artifact: Nullable<ActiveContextArtifact>): void => {
    if (!isCurrent()) return
    setState((current) => current.scope === scope ? { ...current, artifact } : current)
  }, [isCurrent, scope])

  const refreshGoalLifecycle = useCallback(async (): Promise<void> => {
    if (!isCurrent()) return
    try {
      const result = await actionPort.getGoalLifecycle(sessionId)
      if (result.ok) applyGoal(result.goal)
    } catch (error) {
      if (isCurrent()) log.warn('读取目标生命周期状态失败', { error, sessionId })
    }
  }, [actionPort, applyGoal, isCurrent, sessionId])
  const refreshKey = useMemo(() => getGoalLifecycleRefreshKey(messages), [messages])
  useEffect(() => {
    let active = true
    void actionPort.getGoalLifecycle(sessionId).then((result) => {
      if (active && result.ok) applyGoal(result.goal)
    }).catch((error) => {
      if (active && isCurrent()) log.warn('刷新目标生命周期状态失败', { error, sessionId })
    })
    return () => { active = false }
  }, [actionPort, applyGoal, isCurrent, sessionId, messages.length, runtime.lastRunFinishedAt, runtime.status, refreshKey])

  const handleGoalLifecycleAction = useCallback(async (action: ChatGoalLifecycleAction): Promise<boolean> => {
    if (goalLifecycleBusy || !isCurrent()) return false
    setState((current) => current.scope === scope ? { ...current, busy: true } : current)
    try {
      const result = await actionPort.updateGoalLifecycle(sessionId, action)
      if (!isCurrent()) return false
      if (result.ok) {
        applyGoal(action === 'remove' ? null : result.goal)
        return true
      }
      await refreshGoalLifecycle()
      return false
    } catch (error) {
      if (isCurrent()) {
        log.warn('更新目标生命周期状态失败', { action, error, sessionId })
        await refreshGoalLifecycle()
      }
      return false
    } finally {
      if (isCurrent()) setState((current) => current.scope === scope ? { ...current, busy: false } : current)
    }
  }, [actionPort, applyGoal, goalLifecycleBusy, isCurrent, refreshGoalLifecycle, scope, sessionId])

  const handleContinueGoal = useCallback(async (): Promise<void> => {
    const resumed = await handleGoalLifecycleAction('resume')
    if (!resumed || !isCurrent()) return
    const guidance = t('chat.goalDockContinueGuidance')
    if (!isRunActive) {
      await onContinueGoal?.(guidance)
      return
    }
    try {
      await actionPort.provideExecutionGuidance(sessionId, guidance)
    } catch (error) {
      if (isCurrent()) {
        log.warn('发送目标继续引导失败', { error, sessionId })
        await refreshGoalLifecycle()
      }
    }
  }, [actionPort, handleGoalLifecycleAction, isCurrent, isRunActive, onContinueGoal, refreshGoalLifecycle, sessionId, t])

  return { goalLifecycleArtifact, goalLifecycleBusy, handleGoalLifecycleAction, handleContinueGoal }
}
