import type { RefObject } from 'react'

export interface ConversationScrollAnchor {
  messageId: string
  offset: number
}

export interface ConversationScrollView {
  scrollTop: number
  following: boolean
  anchor: Nullable<ConversationScrollAnchor>
}

export interface ConversationScrollScope {
  restoreKey: unknown
  resetKey: unknown
  followLocked: boolean
  view: ConversationScrollView | undefined
}

const ScrollScopeReader = Symbol('conversation-scroll-scope-reader')
type ScopeReader = () => ConversationScrollScope
type ScopedRef = RefObject<unknown> & { [ScrollScopeReader]?: ScopeReader }

/** 读取器绑定到本次恢复范围的 ref，不复制滚动快照，也不依赖父子 layout effect 的登记顺序。 */
export function bindConversationScrollScope<T extends RefObject<unknown>>(
  ref: T,
  readScope: ScopeReader
): T {
  return Object.assign(ref, { [ScrollScopeReader]: readScope })
}

export function readConversationScrollScope(ref: RefObject<unknown>): ConversationScrollScope | undefined {
  return (ref as ScopedRef)[ScrollScopeReader]?.()
}
