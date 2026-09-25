import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ChatComposerModelSelectorControl } from '../../packages/ui/src/conversation/composer/ChatComposer'
import {
  ComposerModelRunSelector,
  type ComposerModelRunSelectorProps,
} from '../../packages/ui/src/conversation/composer/ComposerModelRunSelector'
import {
  ConversationComposerPortProvider,
  emptyConversationComposerPort,
} from '../../packages/ui/src/conversation/composer/conversationComposerPort'
import { conversationZhCNMessages } from '../../packages/ui/src/conversation/i18n'

function lookupMessage(key: string): string {
  let node: unknown = conversationZhCNMessages
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  return typeof node === 'string' ? node : key
}

const modelSelector: ChatComposerModelSelectorControl = {
  label: '模型',
  provider: 'openai',
  model: 'gpt-5.5',
  providers: [
    {
      value: 'openai',
      label: 'OpenAI',
      defaultModel: 'gpt-5.5',
      models: [{ value: 'gpt-5.5', label: 'gpt-5.5' }],
    },
  ],
  onChange: () => undefined,
}

function renderSelector(props: Omit<ComposerModelRunSelectorProps, 't' | 'modelSelector'>): string {
  return renderToStaticMarkup(
    createElement(
      ConversationComposerPortProvider,
      { value: emptyConversationComposerPort },
      createElement(ComposerModelRunSelector, { t: lookupMessage, modelSelector, ...props })
    )
  )
}

const autoLabel = `>${lookupMessage('chat.composerRunProfile_auto')}<`

void test('没有运行档时，模型名旁显示推理力度，不编一个「自动」', () => {
  const markup = renderSelector({ thinkingDepth: { value: 'high', onChange: () => undefined } })

  assert.ok(markup.includes(`>${lookupMessage('chat.composerThinkingDepth_high')}<`), markup)
  assert.ok(markup.includes('title="gpt-5.5 / 高"'), markup)
  assert.ok(!markup.includes(autoLabel), markup)
})

void test('运行档与推理力度都没有时，那一格空着', () => {
  const markup = renderSelector({})

  assert.ok(markup.includes('title="gpt-5.5"'), markup)
  assert.ok(!markup.includes(autoLabel), markup)
})
