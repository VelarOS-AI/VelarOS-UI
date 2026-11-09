/** 基础会话门面的实例边界；消息与滚动实现共用原组件。 */
import { type ComponentProps, memo, type ReactElement } from 'react'

import { MessageBubble as SharedMessageBubble } from '../blocks/MessageBubble'
import { ChatConversationPane as SharedChatConversationPane } from '../shell/ChatConversationPane'
import { ChatTranscript as SharedChatTranscript } from '../shell/ChatTranscript'

import {
  BasicConversationMarkdownProfile,
  ConversationMarkdownProfileProvider,
} from './conversationMarkdownProfile'

export const ChatConversationPane: typeof SharedChatConversationPane = (props) => (
  <ConversationMarkdownProfileProvider profile={BasicConversationMarkdownProfile}>
    <SharedChatConversationPane {...props} />
  </ConversationMarkdownProfileProvider>
)

function BasicChatTranscript(props: ComponentProps<typeof SharedChatTranscript>): ReactElement {
  return (
    <ConversationMarkdownProfileProvider profile={BasicConversationMarkdownProfile}>
      <SharedChatTranscript {...props} />
    </ConversationMarkdownProfileProvider>
  )
}

export const ChatTranscript: typeof SharedChatTranscript = memo(BasicChatTranscript)
ChatTranscript.displayName = 'ChatTranscript'

function BasicMessageBubble(props: ComponentProps<typeof SharedMessageBubble>): Nullable<ReactElement> {
  return (
    <ConversationMarkdownProfileProvider profile={BasicConversationMarkdownProfile}>
      <SharedMessageBubble {...props} />
    </ConversationMarkdownProfileProvider>
  )
}

export const MessageBubble: typeof SharedMessageBubble = memo(BasicMessageBubble)
MessageBubble.displayName = 'MessageBubble'
