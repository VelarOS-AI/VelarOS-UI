/**
 * Pure presentation contracts owned by Conversation UI.
 *
 * Product/runtime packages adapt their richer domain objects to these structural DTOs at the
 * composition boundary. Keep this module data-only: no Kernel, Agent, Workspace, IPC or store
 * imports are allowed here.
 */

export type AppLocale = 'zh-CN' | 'en-US'

export type ChatProviderId =
  | 'velaros'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'xai'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'mistral'
  | 'minimax'
  | 'groq'
  | 'volcengine'
  | 'ollama'
  | 'lmstudio'
  | 'openai-compatible-gateway'
  | 'custom'
  | (string & {})

export type ReasoningLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type RunProfileSelectionId = 'auto' | 'compact' | 'balanced' | 'expanded'
export type WorkspaceSpaceKind = string
export type AgentRoleId = 'chat' | 'operator' | 'architect' | 'coder' | 'browser' | 'primary-agent'
export type ExecutionTaskStatus =
  | 'pending'
  | 'running'
  | 'awaiting_confirmation'
  | 'awaiting_input'
  | 'aborted'
  | 'completed'
  | 'failed'
export type MicrophonePermissionStatus =
  'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export type ChatPromptFeatureId =
  | 'plan'
  | 'office'
  | 'office-document'
  | 'office-spreadsheet'
  | 'office-presentation'
  | 'office-pdf-convert'
  | 'office-pdf-edit'
  | 'office-latex-pdf'
  | 'computer-use'
  | 'html-artifact'
  | 'workbench-editor'
  | 'widget'

export type ToolCategoryId =
  | 'agent-control'
  | 'context'
  | 'planning'
  | 'interaction'
  | 'web'
  | 'browser'
  | 'browser-core'
  | 'browser-session'
  | 'browser-observe'
  | 'browser-network'
  | 'browser-events'
  | 'browser-files'
  | 'browser-advanced'
  | 'memory'
  | 'knowledge'
  | 'office'
  | 'system'
  | 'system-files'
  | 'system-execution'
  | 'system-processes'
  | 'system-desktop'
  | 'computer-control'
  | 'scheduling'
  | 'project'
  | 'project-files'
  | 'project-changes'
  | 'project-execution'
  | 'development-code'
  | (string & {})

export type ToolPermission =
  | 'fs:read'
  | 'fs:write'
  | 'process:exec'
  | 'process:exec:unsafe'
  | 'system:open'
  | 'system:app'
  | 'project:root'
  | 'screen:capture'
  | 'window:track'
  | 'input:control'
  | 'network'
  | 'memory:read'
  | 'memory:write'

export type ToolRenderKind =
  | 'command'
  | 'file-change'
  | 'edit-diff'
  | 'edit-rollback'
  | 'file-move'
  | 'refactor'
  | 'plan'
  | 'search'
  | 'list-files'
  | 'browse-remote'
  | 'browser'
  | 'memory'
  | 'knowledge'
  | 'git'
  | 'office-doc'
  | 'artifact'
  | 'widget'
  | 'read-local'
  | 'install'
  | 'system'
  | 'tool-catalog'
  | 'tool-map'
  | 'tool-read'
  | 'tool-replace'
  | 'tool-reflect'
  | 'goal'
  | 'active-directive'
  | 'archive'
  | 'user-confirmation'
  | 'user-action'
  | 'agent-dispatch'
  | 'active-project-infer'
  | 'dev-environment-summary'
  | 'project-discovery-rescan'
  | 'project-roots'
  | 'project-catalog'
  | 'project-metadata'
  | 'generic'

export type ToolActivityKind =
  | 'file-change'
  | 'command'
  | 'direct-file-read'
  | 'multi-file-read'
  | 'search'
  | 'file-move'
  | 'user-input'
  | 'user-confirmation'
  | 'verification-command'

export interface TextBlock {
  type: 'text'
  text: string
  tone?: 'default' | 'error'
}

export interface ThinkingBlock {
  type: 'thinking'
  text: string
  streamId?: string
  translatedText?: string
  translatedLocale?: AppLocale
  translationVisible?: boolean
}

export interface ToolCallBlock {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  categoryId?: ToolCategoryId
  result?: unknown
  serializedResult?: string
  resultStoredInWorkspace?: boolean
  error?: string
  isRunning?: boolean
  startedAt?: number
  finishedAt?: number
  progress?: string
  title?: string
  metadata?: Record<string, unknown>
  effects?: StreamToolResultEffects
  modelImage?: {
    mediaType: 'image/jpeg' | 'image/png'
    data: string
    size?: number
  }
}

export interface StreamToolResultEffects {
  workspaceRefresh?: boolean
  fileChanged?: boolean
  browserContextChanged?: boolean
  workspaceMutated?: boolean
  changedRoot?: string
}

export interface AssistantGeneratedFileBlock {
  type: 'assistant-generated-file'
  id: string
  mediaType: string
  data?: string
  size: number
  filename?: string
  storedInWorkspace?: boolean
}

export interface AssistantSourceBlock {
  type: 'assistant-source'
  id: string
  sourceType: 'url'
  url: string
  title?: string
}

export type UserActionCardTone = 'info' | 'warning' | 'success' | 'danger'
export type UserActionCardIcon =
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'plugin'
  | 'plan'
  | 'target'
  | 'tool'
  | 'workspace'
  | 'memory'
export type UserActionCardActionIcon =
  | 'confirm'
  | 'plugin'
  | 'plan'
  | 'target'
  | 'open'
  | 'send'
  | 'reject'
  | 'input'
  | 'tool'
  | 'workspace'
  | 'memory'

export type UserActionFormFieldType =
  'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'checkboxes'
export type UserActionFormValue = string | number | boolean | string[]

export interface UserActionFormOption {
  value: string
  label: string
  description?: string
  recommended?: boolean
}

export interface UserActionFormField {
  id: string
  type: UserActionFormFieldType
  label: string
  required?: boolean
  placeholder?: string
  help?: string
  options?: UserActionFormOption[]
  min?: number
  max?: number
  step?: number
  maxLength?: number
  defaultValue?: UserActionFormValue
}

export interface UserActionCardTextInput {
  placeholder?: string
  required?: boolean
  maxLength?: number
}

interface UserActionCardActionBase {
  label: string
  completedLabel?: string
  icon?: UserActionCardActionIcon
  completedDescription?: string
  disableAfterClick?: boolean
}

export type UserActionCardAction =
  | (UserActionCardActionBase & { kind: 'acknowledge' })
  | (UserActionCardActionBase & {
      kind: 'reject'
      input?: UserActionCardTextInput
    })
  | (UserActionCardActionBase & {
      kind: 'submit_input'
      input: UserActionCardTextInput
    })
  | (UserActionCardActionBase & { kind: 'submit_form' })

export interface UserActionCardResult {
  cardId: string
  actionKind: UserActionCardAction['kind'] | 'timeout' | 'skip'
  approved: boolean
  message?: string
  values?: Record<string, UserActionFormValue>
  timedOut?: boolean
}

/**
 * 卡片结算记录：一张卡「是否已作答」的**唯一权威**，随会话存档落盘在对应 block 上。
 *
 * 上一版把这件事分散在三处（localStorage 三前缀 / 组件 useState / 主进程 SQLite），
 * 没一份跟着存档走：换台机器或清一次浏览器存储，历史动作卡全部复活成可点状态，
 * 定时任务提案卡还能二次创建。渲染层现在只读本记录，不再自持"已消费"状态。
 */
export interface ConversationCardResolution {
  actionKind: UserActionCardAction['kind'] | 'timeout' | 'skip'
  approved: boolean
  message?: string
  values?: Record<string, UserActionFormValue>
  timedOut?: boolean
  settledAt: number
}

export interface UserActionCard {
  id: string
  title: string
  description: string
  tone: UserActionCardTone
  icon: UserActionCardIcon
  blocking: boolean
  actions: UserActionCardAction[]
  artifact?: { path: string; label?: string }
  form?: {
    layout?: 'stack' | 'grid'
    submitLabel?: string
    cancelLabel?: string
    fields: UserActionFormField[]
    presentation?: 'wizard'
  }
  timeoutMs?: number
  createdAt: number
}

/** 命令因缺系统工具失败时，宿主随命令结果附上的安装建议（`ProjectCommandResult.systemToolSuggestion`）。 */
export interface SystemToolInstallSuggestion {
  id: string
  toolId: string
  label: string
  command: string
  packageName: string
  reason: string
  installCommand: Nullable<string>
  installAvailable: boolean
  detectedAt: number
  triggeredBy: {
    scope: 'project' | 'system'
    command: string
  }
  alternatives?: Array<{
    id: string
    label: { 'zh-CN': string; 'en-US': string }
    description: { 'zh-CN': string; 'en-US': string }
    draft: { 'zh-CN': string; 'en-US': string }
  }>
}

/** 脚本执行里的一次能力调用，按发出顺序排在 `ScriptExecutionBlock.calls` 里。 */
export interface ScriptExecutionCall {
  /** 模块 id，如 'velaros:shell'。 */
  module: string
  /** 操作名，如 'run'。 */
  operation: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  /** 外部效果：none / committed / partial / unknown。 */
  effect: 'none' | 'committed' | 'partial' | 'unknown'
  /** 有界参数原文（JSON 文本）。 */
  input: string
  /** 有界返回值或错误原文（JSON 文本）。 */
  output: string
  inputTruncated: boolean
  outputTruncated: boolean
}

/** 一次 ScriptAct 脚本执行：模型一轮里的一个 execute 声明。宿主已取好 title。 */
export interface ScriptExecutionBlock {
  type: 'script-execution'
  /** 稳定身份，同一张卡的更新按它原位替换。 */
  id: string
  /** 哪种程序声明：execute 这一轮执行一次；observe 登记持续观察，从下一回合起每帧运行。 */
  kind: 'execute' | 'observe'
  /** 一句话说明这一步做什么；可能为空串，此时界面按模块与操作兜底。 */
  title: string
  status: 'writing' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  /** 脚本源码（有界）；writing 阶段可能为空。 */
  source: string
  sourceTruncated: boolean
  calls: ScriptExecutionCall[]
  /** 脚本本身失败（导入、检查或运行错误）的原因。 */
  error?: string
  /** 这一步执行用了多少毫秒；观察卡是最近一次运行的。还没有结果时为 null。 */
  durationMs: Nullable<number>
}

/** 交互卡的种类：带选项的提问、表单、一句话的提问、确认、危险命令、登录墙、能力申请。 */
export type InteractionKind =
  | 'choice'
  | 'form'
  | 'input'
  | 'confirm'
  | 'danger'
  | 'login'
  | 'capability'

/** pending 等回答；answered 已回答或已批准；declined 跳过或拒绝；expired 运行结束前没答，不再有效。 */
export type InteractionStatus = 'pending' | 'answered' | 'declined' | 'expired'

export interface InteractionOption {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export interface InteractionField {
  id: string
  label: string
  kind: 'text' | 'number' | 'boolean' | 'choice'
  options?: InteractionOption[]
  multiple?: boolean
  required?: boolean
  placeholder?: string
}

/** 表单里一项的值：文字、数、真假，或选项 id（多选时是 id 列表）。 */
export type InteractionValue = string | number | boolean | string[]

/**
 * 用户给的回答：选项题是选中的 id 与另写的话，表单是各项的值，提问与能力申请是一段话，确认是批准；
 * 拒绝确认、跳过提问都是 declined，可以带理由。
 */
export interface InteractionAnswer {
  choices?: string[]
  text?: string
  values?: Record<string, InteractionValue>
  approved?: boolean
  declined?: boolean
  reason?: string
}

/**
 * 与用户的一次交互：模型的提问、表单、确认与能力申请，宿主的危险命令确认与登录墙。说明保留原文与换行；
 * 回答后原位写上回答，运行收尾时没答的标成失效。
 */
export interface InteractionBlock {
  type: 'interaction'
  /** 请求身份，同一张卡的更新原位替换。 */
  id: string
  kind: InteractionKind
  message: string
  options?: InteractionOption[]
  multiple?: boolean
  allowText?: boolean
  fields?: InteractionField[]
  /** 危险命令的操作：命令与它的工作目录。 */
  operation?: { label: string; target?: string }
  status: InteractionStatus
  answer?: InteractionAnswer
}

/** 模型交来的小部件：一段 HTML 片段或 SVG，界面在沙箱里显示。 */
export interface WidgetBlock {
  type: 'widget'
  /** 交来它的那次调用的身份，同一个小部件的重放原位替换。 */
  id: string
  title: string
  code: string
  /** 初始高度，像素。 */
  height: number
}

/** 对话里的一步：旧的工具调用，或 ScriptAct 的脚本卡；子 Agent 面板挂在派发它的那一步后面。 */
export type ConversationStepBlock = ToolCallBlock | ScriptExecutionBlock

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolCallBlock
  | ScriptExecutionBlock
  | InteractionBlock
  | WidgetBlock
  | AssistantGeneratedFileBlock
  | AssistantSourceBlock

export interface ChatAttachmentMeta {
  id: string
  kind: 'image' | 'file'
  name: string
  mediaType: string
  size: number
  path?: string
  lastModified?: number
}

export interface SerializedImageAttachment {
  id: string
  kind: 'image'
  filename: string
  mediaType: string
  data: string
  size: number
}

export interface BrowserElementSelectionRect {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export interface BrowserElementSelection {
  id: string
  url: string
  title: string
  label: string
  tagName: string
  role: Nullable<string>
  text: string
  selector: Nullable<string>
  attributes: Record<string, string>
  rect: BrowserElementSelectionRect
  viewportWidth: number
  viewportHeight: number
  target: Nullable<{
    ref?: LooseOptional<string>
    css: Nullable<string>
    role: Nullable<string>
    text: Nullable<string>
    name: Nullable<string>
    frame?: LooseOptional<{
      css: Nullable<string>
      name: Nullable<string>
      title: Nullable<string>
      url: Nullable<string>
    }>
    attributes: Record<string, string>
  }>
  capturedAt: number
  interactionSteps?: Array<
    BrowserElementSelection & {
      action: 'click' | 'select'
      sequence: number
      interactionSteps?: never
    }
  >
}

export type TurnContextSourceId = string

export interface TurnContextDelta {
  id: string
  sourceId: TurnContextSourceId
  seq: number
  occurredAt: number
  label: string
  summaryText: string
  inspect?: { tool: string; argsHint?: Record<string, unknown> }
}

export type ChatMessageConversationKind =
  | 'turn-input'
  | 'run-guidance'
  | 'interaction-reply'
  | 'system-notice'
  | 'assistant-output'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  /** 会话产品语义；与发给模型的 role 正交。 */
  conversationKind?: ChatMessageConversationKind
  runId?: string
  turnId?: string
  blocks: ContentBlock[]
  attachments?: ChatAttachmentMeta[]
  browserElementSelections?: BrowserElementSelection[]
  turnContext?: {
    receipt: {
      observedThrough: Partial<Record<TurnContextSourceId, { generation: string; seq: number }>>
      includedDeltaIds: string[]
      dismissedDeltaIds: string[]
      anchorGeneration: string
      anchorCarrierMessageId: string
    }
    chips: Array<{
      sourceId: TurnContextSourceId
      label: string
    }>
    deltas?: TurnContextDelta[]
  }
  serialized?: {
    messageId?: string
    runId?: string
    turnId?: string
    timestamp?: number
    role: 'user' | 'assistant'
    textBlocks: string[]
    imageAttachments?: SerializedImageAttachment[]
    toolCalls: Array<{
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
      serializedResult?: string
    }>
  }
  serializedStoredInWorkspace?: boolean
  /**
   * 系统通知（`conversationKind: 'system-notice'`）是哪一类宿主留痕，只决定通知行的图标；缺省是会话回溯。
   * `goal-continuation` = 目标还在进行中，宿主替用户接着开了一轮。
   */
  systemNoticeKind?: 'rewind' | 'goal-continuation'
  guidanceStatus?: 'awaiting-decision' | 'pending' | 'sent' | 'accepted' | 'applied' | 'paused'
  /**
   * 非空 = 这条 `role: 'user'` 的消息由**同组的另一条会话**写入，不是用户本人。
   *
   * 为什么是独立字段而不是新增一个 `conversationKind`：两者是正交的两根轴。
   * `conversationKind` 是**结构轴**——这条消息起不起一轮、能不能回退到它、是不是分段边界；
   * 而"谁写的、能不能当用户证词采信"是**归属轴**。同伴消息**确实**起一轮真实执行，所以它必须
   * 保持 `turn-input`：把它挪进一个新 kind，会连带丢掉回退按钮、分页分段起点、
   * 「最近一次用户请求」映射、活动分组的轮次边界——而且一处编译错误都不会有。
   */
  peerOrigin?: {
    /** 发信同伴的会话 id。 */
    sessionId: string
    /** 发信同伴的会话标题；未知时为 null。 */
    title: Nullable<string>
    /** 双方所在的会话组 id。 */
    folderId: string
  }
  timestamp: number
}

type ChatMessageConversationSemanticInput = Pick<
  ChatMessage,
  'role' | 'conversationKind' | 'guidanceStatus'
>

export function resolveChatMessageConversationKind(
  message: ChatMessageConversationSemanticInput
): ChatMessageConversationKind {
  if (message.role !== 'user') return 'assistant-output'
  if (
    message.conversationKind === 'turn-input' ||
    message.conversationKind === 'run-guidance' ||
    message.conversationKind === 'interaction-reply' ||
    message.conversationKind === 'system-notice'
  )
    return message.conversationKind

  return message.guidanceStatus ? 'run-guidance' : 'turn-input'
}

export function isConversationTurnInputMessage(
  message: ChatMessageConversationSemanticInput
): boolean {
  return resolveChatMessageConversationKind(message) === 'turn-input'
}

export function isRunGuidanceMessage(
  message: ChatMessageConversationSemanticInput
): boolean {
  return resolveChatMessageConversationKind(message) === 'run-guidance'
}

export function isSystemNoticeMessage(
  message: ChatMessageConversationSemanticInput
): boolean {
  return resolveChatMessageConversationKind(message) === 'system-notice'
}

/**
 * 这条消息是不是同组同伴写的。
 *
 * 刻意**不**走 {@link resolveChatMessageConversationKind}：那个函数解析的是结构轴，而这里问的是
 * 归属轴（见 {@link ChatMessage.peerOrigin}）。两根轴同时成立是常态——一条同伴消息既是
 * `turn-input`，又不是用户本人写的。
 */
export function isPeerOriginMessage(message: Pick<ChatMessage, 'peerOrigin'>): boolean {
  return !!message.peerOrigin
}

export interface ChatSuggestionItem {
  id: string
  title: string
  prompt: string
  reason: string
  confidence: number
}

export interface ModelPricingEntry {
  provider: string
  model: string
  aliases: readonly string[]
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  /** 命中提示缓存的输入单价；缺席时缓存读按 `inputUsdPerMillion` 计（偏高的上界）。 */
  cacheReadUsdPerMillion?: LooseOptional<number>
  /** 写入提示缓存的输入单价；缺席时缓存写按 `inputUsdPerMillion` 计。 */
  cacheWriteUsdPerMillion?: LooseOptional<number>
  source: string
}

export interface ModelPricingCatalog {
  currency: 'USD'
  version: string
  updatedAt: string
  expiresAt: string
  entries: readonly ModelPricingEntry[]
}

export type ChatContextUsageAccountingSource =
  'provider' | 'provider-count' | 'gateway-cost' | 'local-estimate'
export type ChatContextUsageAccountingConfidence = 'high' | 'medium' | 'low'

export interface StreamUsageTelemetryPayload {
  kind: 'usage-telemetry'
  turn: Nullable<number>
  provider?: LooseOptional<ChatProviderId>
  model: string
  inputTokens: Nullable<number>
  outputTokens: Nullable<number>
  visibleOutputTokens?: LooseOptional<number>
  totalTokens: Nullable<number>
  reasoningTokens: Nullable<number>
  cachedInputTokens?: LooseOptional<number>
  cacheReadInputTokens?: LooseOptional<number>
  cacheWriteInputTokens?: LooseOptional<number>
  costUsd?: LooseOptional<number>
  finishReasons?: LooseOptional<string[]>
  rawFinishReasons?: LooseOptional<string[]>
  source: ChatContextUsageAccountingSource
  confidence: ChatContextUsageAccountingConfidence
  timestamp: number
}

export type TeamExecutionPhase =
  | 'creating-task'
  | 'collecting-context'
  | 'preparing-tools'
  | 'building-prompt'
  | 'requesting-model'
  | 'preparing'
  | 'understanding'
  | 'planning'
  | 'researching'
  | 'executing'
  | 'executing-tool'
  | 'waiting-user-browser'
  | 'capturing-browser-screenshot'
  | 'verifying'
  | 'synthesizing'
  | 'waiting-confirmation'
  | 'completed'

export interface StreamTurnContextPayload {
  kind: 'turn-context'
  turn: number
  roleRuntimeModel: LooseOptional<{
    provider: ChatProviderId
    model: string
    providerModel?: LooseOptional<string>
    contextWindow?: LooseOptional<number>
    resolutionSource: 'provider-pool' | 'chat-config'
    resolutionTrace: Array<{
      provider: ChatProviderId
      model: string
      providerModel?: LooseOptional<string>
      status: 'selected' | 'skipped'
      reason?: LooseOptional<string>
    }>
    fallbackReason?: LooseOptional<string>
  }>
}

export interface WorkspaceTaskTarget {
  kind: 'session' | 'project' | 'browser-site' | 'system'
  rootPath?: LooseOptional<string>
  browserUrl?: LooseOptional<string>
  browserSessionId?: LooseOptional<string>
}

export interface PlanTaskDagContract {
  inputs: string[]
  expectedOutputs: string[]
  dependencies: string[]
  artifactSchema: string
  summaryPrompt: string
  nodeId: string
  dependencySummaries: Array<{
    nodeId: string
    summary: string
  }>
  latestSummary?: LooseOptional<string>
}

export interface StreamWorkerThreadPayload {
  kind: 'worker-thread'
  event: 'started' | 'status' | 'delta' | 'chat-event' | 'output' | 'completed' | 'failed'
  threadId: string
  activationId?: LooseOptional<string>
  taskId?: LooseOptional<string>
  nodeId?: LooseOptional<string>
  title: string
  agentName?: LooseOptional<string>
  roleId?: LooseOptional<AgentRoleId>
  phase?: LooseOptional<TeamExecutionPhase>
  status?: LooseOptional<ExecutionTaskStatus>
  workspaceTarget?: LooseOptional<WorkspaceTaskTarget>
  dag?: LooseOptional<PlanTaskDagContract>
  timestamp: number
  input?: LooseOptional<string>
  text?: LooseOptional<string>
  summary?: LooseOptional<string>
  error?: LooseOptional<string>
  chatEvent?: LooseOptional<unknown>
  subagentType?: LooseOptional<string>
  customAgentName?: LooseOptional<string>
  mode?: LooseOptional<'sync' | 'async'>
  model?: LooseOptional<string>
  result?: LooseOptional<unknown>
}

export interface ChatStreamReasoningEvent {
  type: 'reasoning'
  payload: { id: string; text: string }
}

export type ChatStreamEvent =
  | ChatStreamReasoningEvent
  | {
      type: 'tool-call'
      payload: {
        toolCallId: string
        toolName: string
        args: Record<string, unknown>
        categoryId?: ToolCategoryId
      }
    }
  | {
      type: 'tool-progress'
      payload: { toolCallId: string; chunk: string; timestamp?: number }
    }
  | {
      type: 'tool-metadata'
      payload: {
        toolCallId: string
        title?: string
        metadata?: Record<string, unknown>
        timestamp?: number
      }
    }
  | {
      type: 'tool-result'
      payload: {
        toolCallId: string
        result: unknown
        error?: string
        effects?: StreamToolResultEffects
        modelImage?: { data: string; mediaType: 'image/png' | 'image/jpeg' }
      }
    }
  | { type: 'worker-thread'; payload: StreamWorkerThreadPayload }
  | { type: 'state'; payload: { kind: string } }
  | { type: 'debug'; payload: { kind: string } }
  | { type: 'notice'; kind: string; payload: unknown }
  | { type: 'end' }
  | { type: 'error'; payload: { code?: string; message?: string } }

export interface ProjectRootEntry {
  path: string
  active: boolean
  exists: boolean
  removable: boolean
  source: 'project'
}

export interface ProjectBackgroundProcessInfo {
  taskId: Nullable<string>
  sessionId: Nullable<string>
  pid: Nullable<number>
  logPath: Nullable<string>
  ports: number[]
  reason: Nullable<string>
  terminateCommand: Nullable<string>
  forceTerminateCommand: Nullable<string>
  fallbackTerminateCommand: Nullable<string>
  requested: boolean
  autoStarted: boolean
  /** 交互式任务的控制台：命令在控制台里等用户输入，聊天里渲染成控制台卡片。不是交互式任务时缺席。 */
  console?: LooseOptional<SystemConsoleSessionInfo>
}

/** 控制台后面接的是什么：宿主给的真终端，还是一根保持打开的 stdin 管道（没有回显）。 */
export type SystemConsoleChannel = 'pty' | 'pipe'

/** 一个交互式任务的控制台；与 `@velaros-ai/system` 的同名数据对齐。 */
export interface SystemConsoleSessionInfo {
  taskId: string
  channel: SystemConsoleChannel
  /** 现在还能不能往里写输入；进程退出后为 false。 */
  acceptsInput: boolean
  /** 一句说明：任务正在控制台里等用户。 */
  note: string
}

export interface ProjectVerificationSummary {
  kind: 'build' | 'lint' | 'test' | 'typecheck' | 'unknown'
  status: 'aborted' | 'failed' | 'passed' | 'timed-out' | 'unknown'
  issues: string[]
}

export interface ProjectCommandResult {
  command: string
  cwd: string
  exitCode: Nullable<number>
  signal: Nullable<string>
  stdout: string
  stderr: string
  logPath?: LooseOptional<string>
  durationMs: number
  timedOut: boolean
  aborted: boolean
  truncated: boolean
  success: boolean
  backgroundProcess?: LooseOptional<ProjectBackgroundProcessInfo>
  verification: ProjectVerificationSummary
  systemToolSuggestion?: LooseOptional<SystemToolInstallSuggestion>
}

export interface SystemFileChangePreviewResult {
  changeId: string
  rootPath?: string
  path: string
  created: boolean
  deleted?: boolean
  rolledBack: boolean
  revertAvailable?: boolean
  beforeContent: string
  afterContent: string
}

export interface ProjectCheckpointFileDiff {
  root: string
  path: string
  patch: string
  additions: number
  deletions: number
  status: 'added' | 'deleted' | 'modified'
  binary: boolean
}

export interface ProjectCheckpointDiffFailure {
  root: string
  fromCommitId: string
  toCommitId: string
  error: string
}

export type ChatGoalLifecycleAction =
  'resume' | 'pause' | 'block' | 'complete' | 'cancel' | 'remove'

export interface ActiveContextArtifact {
  id: string
  kind: 'plan' | 'decision' | 'requirement'
  scope: 'session' | 'workspace'
  status: 'active' | 'completed' | 'archived'
  sessionId: string
  workspaceRoot?: LooseOptional<string>
  title: string
  content: string
  sourceMessageId?: LooseOptional<string>
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
