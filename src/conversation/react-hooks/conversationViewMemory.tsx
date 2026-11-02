import { createContext, type Dispatch, type ReactNode, type SetStateAction, useCallback, useContext, useRef, useState } from 'react'

import { isFunction, isPresent } from '#internal/runtime'

// 只保存轻量视图数据，不保留组件、DOM 或会话正文；刷新应用即清空。
const expansions = new Map<string, Map<string, boolean>>()
const SessionContext = createContext('')

export function ConversationViewMemoryProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  return <SessionContext.Provider value={sessionId}>{children}</SessionContext.Provider>
}

export function useConversationViewExpansion(key: LooseOptional<string>, initial: boolean): [boolean, Dispatch<SetStateAction<boolean>>, boolean] {
  const sessionId = useContext(SessionContext)
  const cached = key ? expansions.get(sessionId)?.get(key) : undefined
  const [local, setLocal] = useState({ sessionId, key, value: initial })
  const value = cached ?? (local.sessionId === sessionId && local.key === key ? local.value : initial)
  const valueRef = useRef(value)
  valueRef.current = value
  const setValue = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const current = key ? expansions.get(sessionId)?.get(key) ?? valueRef.current : valueRef.current
    const resolved = isFunction(next) ? next(current) : next
    if (sessionId && key) {
      let session = expansions.get(sessionId)
      if (!session) {
        session = new Map()
        expansions.set(sessionId, session)
      }
      session.set(key, resolved)
    }
    valueRef.current = resolved
    setLocal({ sessionId, key, value: resolved })
  }, [key, sessionId])
  return [value, setValue, isPresent(cached)]
}
