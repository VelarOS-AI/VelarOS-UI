import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { MessageMarkdownBlock } from '../../src/conversation/blocks/MessageMarkdownBlocks'
import { ScriptBlobsCard } from '../../src/conversation/cards/ScriptExecutionCard'
import { ConversationLocalizationProvider, conversationZhCNMessages } from '../../src/conversation/i18n'

const root = createRoot(document.getElementById('root')!)
flushSync(() => root.render(
  <ConversationLocalizationProvider value={{ locale: 'zh-CN', t: (key) => String(key.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], conversationZhCNMessages)) }}>
    <MessageMarkdownBlock block={{ type: 'text', text: '第一段。\n\n这是最后一行文字。' }} tailMarker={{ status: 'aborted', timestamp: 1 }} />
    <ScriptBlobsCard blocks={['list', 'dialog', 'css'].map((title) => ({ type: 'script-execution', kind: 'blobs', id: title, title, source: `literal-${title}`, status: 'succeeded', sourceTruncated: false, calls: [] }))} />
  </ConversationLocalizationProvider>
))
