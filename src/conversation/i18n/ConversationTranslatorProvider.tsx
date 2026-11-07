import { createContext, type ReactNode, useContext } from 'react'

import { type ConversationTranslatorRuntime } from './conversationTranslator'

const ConversationTranslatorRuntimeContext =
  createContext<Nullable<ConversationTranslatorRuntime>>(null)

export function ConversationTranslatorProvider({
  children,
  runtime,
}: {
  children: ReactNode
  runtime: ConversationTranslatorRuntime
}): React.JSX.Element {
  return (
    <ConversationTranslatorRuntimeContext.Provider value={runtime}>
      {children}
    </ConversationTranslatorRuntimeContext.Provider>
  )
}

/** 返回当前 React root 注入的翻译运行时。 */
export function useConversationTranslatorRuntime(): ConversationTranslatorRuntime {
  const runtime = useContext(ConversationTranslatorRuntimeContext)
  if (!runtime)
    throw new Error(
      'useConversationTranslatorRuntime must be used within ConversationTranslatorProvider'
    )
  return runtime
}
