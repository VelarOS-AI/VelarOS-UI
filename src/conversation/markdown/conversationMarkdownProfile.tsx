/** 展示能力按组件实例固定；默认基础配置不引用完整插件或其加载器。 */
import { createContext, type ReactElement, type ReactNode, useContext, useRef } from 'react'
import { cjk } from '@streamdown/cjk'
import type { PluginConfig } from 'streamdown'

export type ConversationMarkdownProfile =
  | { readonly kind: 'basic'; readonly plugins: PluginConfig }
  | { readonly kind: 'full'; readonly loadPlugins: () => Promise<PluginConfig> }

export const BasicConversationMarkdownProfile: ConversationMarkdownProfile = Object.freeze({
  kind: 'basic',
  plugins: Object.freeze({ cjk }),
})

const ConversationMarkdownProfileContext = createContext<Nullable<ConversationMarkdownProfile>>(null)

export function ConversationMarkdownProfileProvider({
  profile,
  children,
}: {
  profile: ConversationMarkdownProfile
  children: ReactNode
}): ReactElement {
  // 最外层会话实例决定整棵消息树，嵌套的完整门面不能把基础会话改回完整展示。
  const inheritedProfile = useContext(ConversationMarkdownProfileContext)
  const fixedProfile = useRef(inheritedProfile ?? profile).current
  return (
    <ConversationMarkdownProfileContext.Provider value={fixedProfile}>
      {children}
    </ConversationMarkdownProfileContext.Provider>
  )
}

export function useConversationMarkdownProfile(): ConversationMarkdownProfile {
  return useContext(ConversationMarkdownProfileContext) ?? BasicConversationMarkdownProfile
}
