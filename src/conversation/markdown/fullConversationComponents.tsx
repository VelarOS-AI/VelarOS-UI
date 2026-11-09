/** 既有完整门面的实例边界；高级依赖只从此装配路径进入。 */
import { type ComponentProps, memo, type ReactElement, type ReactNode } from 'react'
import type { PluginConfig } from 'streamdown'

import { MessageBubble as SharedMessageBubble } from '../blocks/MessageBubble'
import { ChatConversationPane as SharedChatConversationPane } from '../shell/ChatConversationPane'
import { ChatTranscript as SharedChatTranscript } from '../shell/ChatTranscript'

import {
  type ConversationMarkdownProfile,
  ConversationMarkdownProfileProvider,
} from './conversationMarkdownProfile'

let fullPlugins: Nullable<Promise<PluginConfig>> = null

/** 共享加载回执只缓存不可变资源；打开会话壳不提前加载高级展示插件。 */
function loadFullPlugins(): Promise<PluginConfig> {
  fullPlugins ??= import('./streamdownMarkdown.config').then((module) =>
    Object.freeze({ ...module.STREAMDOWN_MARKDOWN_PLUGINS })
  )
  return fullPlugins
}

const FullConversationMarkdownProfile: ConversationMarkdownProfile = Object.freeze({
  kind: 'full',
  loadPlugins: loadFullPlugins,
})

/** 内部完整入口与其行为测试共用同一不可变装配，不作为宿主扩展端口。 */
export function FullConversationMarkdownProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <ConversationMarkdownProfileProvider profile={FullConversationMarkdownProfile}>
      {children}
    </ConversationMarkdownProfileProvider>
  )
}

export const ChatConversationPane: typeof SharedChatConversationPane = (props) => (
  <FullConversationMarkdownProvider>
    <SharedChatConversationPane {...props} />
  </FullConversationMarkdownProvider>
)

function FullChatTranscript(props: ComponentProps<typeof SharedChatTranscript>): ReactElement {
  return (
    <FullConversationMarkdownProvider>
      <SharedChatTranscript {...props} />
    </FullConversationMarkdownProvider>
  )
}

export const ChatTranscript: typeof SharedChatTranscript = memo(FullChatTranscript)
ChatTranscript.displayName = 'ChatTranscript'

function FullMessageBubble(props: ComponentProps<typeof SharedMessageBubble>): Nullable<ReactElement> {
  return (
    <FullConversationMarkdownProvider>
      <SharedMessageBubble {...props} />
    </FullConversationMarkdownProvider>
  )
}

export const MessageBubble: typeof SharedMessageBubble = memo(FullMessageBubble)
MessageBubble.displayName = 'MessageBubble'
