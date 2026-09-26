/**
 * cards 原子——会话卡片渲染件（通知 / 骨架 / 文件变更汇总 / 执行步骤 / 交互卡与轮播提问 / 小部件 /
 * user-action 卡）+ 其纯呈现层与随迁叶子件。user-action 卡的 viewmodel 有状态半壁留宿主，本层只吃投影
 * （`view: UserActionCardView`）；交互卡的回答经会话壳挂的 `InteractionAnswerProvider` 交给宿主。
 */
export { AskUserCarousel, type AskUserDraft, type AskUserQuestion } from './AskUserCarousel'
export { ChatConversationSkeleton } from './ChatConversationSkeleton'
export { ChatNoticeCard } from './ChatNoticeCard'
export { formatScriptModuleLabel, resolveScriptExecutionTitle } from './executionStepPresentation'
export * from './fileChangeDiff'
export { FileChangeSummaryList, type FileChangeSummaryListEntry } from './FileChangeSummaryList'
export {
  type AnswerInteraction,
  InteractionAnswerProvider,
  useInteractionAnswer,
} from './interactionAnswerContext'
export { InteractionCard, type InteractionCardProps } from './InteractionCard'
export { ScriptExecutionCard, type ScriptExecutionCardProps } from './ScriptExecutionCard'
export { ToolCallStepCard, type ToolCallStepCardProps } from './ToolCallStepCard'
export { UserActionCard } from './UserActionCard'
export * from './userActionCardPresentation'
export type { UseSuggestionCardRejectionResult } from './useSuggestionCardRejection'
export { useSuggestionCardRejection } from './useSuggestionCardRejection'
export { WidgetCard, type WidgetCardProps } from './WidgetCard'
