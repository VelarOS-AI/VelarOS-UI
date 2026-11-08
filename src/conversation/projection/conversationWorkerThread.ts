import type { ChatMessage, ExecutionTaskStatus, TeamExecutionPhase } from '#contracts'

/**
 * 一次子 Agent 激活的展示数据；同一 Agent 续跑时有独立 threadId，展示名称由宿主保持稳定。
 * 线程面板由宿主经 workerThreadPanel 插槽提供，UI 负责按脚本锚点或消息时间落位。
 */
export interface ConversationWorkerThread {
  threadId: string
  /** 派发它的那一步（脚本卡）的 id；给了而且那张卡在对话里，面板就挂在它后面。 */
  anchorId?: string
  title: string
  agentName: Nullable<string>
  phase: Nullable<TeamExecutionPhase>
  status: Nullable<ExecutionTaskStatus>
  subagentType: Nullable<string>
  model: Nullable<string>
  startedAt: number
  updatedAt: number
  input: Nullable<string>
  output: Nullable<string>
  error: Nullable<string>
  messages: ChatMessage[]
}
