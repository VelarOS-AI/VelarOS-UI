import { createContext, type ReactElement, type ReactNode, useContext } from 'react'

import type { InteractionAnswer } from '#contracts'

/** 把交互卡上的回答交给宿主：按请求身份交回，交成功后宿主原位更新这张卡。 */
export type AnswerInteraction = (requestId: string, answer: InteractionAnswer) => Promise<void> | void

const InteractionAnswerContext = createContext<Nullable<AnswerInteraction>>(null)

/** 会话壳在消息区外面挂上这一层，消息里的交互卡从这里拿回答通道；没挂时卡片只读。 */
export function InteractionAnswerProvider({
  value,
  children,
}: {
  value: Nullable<AnswerInteraction>
  children: ReactNode
}): ReactElement {
  return <InteractionAnswerContext.Provider value={value}>{children}</InteractionAnswerContext.Provider>
}

export function useInteractionAnswer(): Nullable<AnswerInteraction> {
  return useContext(InteractionAnswerContext)
}
