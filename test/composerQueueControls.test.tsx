import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ChatInputQueuePanel } from '../src/conversation/composer/ChatInputQueuePanel'
import { ComposerToolbarRight } from '../src/conversation/composer/ComposerToolbarRight'
import { ConversationLocalizationProvider } from '../src/conversation/i18n/ConversationLocalizationProvider'

void test('composer renders one primary send or stop action', () => {
  for (const kind of ['send', 'sending', 'stop'] as const) {
    const markup = renderToStaticMarkup(createElement(ComposerToolbarRight, {
      chrome: {},
      voice: {
        showVoiceInput: false, voiceInputLabel: '', voiceInputTitle: '', voiceInputDisabled: false,
        isVoiceListening: false, voiceInputSupported: false, voiceButtonClassName: '', onToggleVoiceInput: () => {},
      },
      primaryAction: {
        kind, showButton: true, title: kind, disabled: false, pending: kind === 'sending',
        buttonClassName: '', onSendClick: () => {}, onStop: () => {},
      },
    }))
    assert.equal(markup.match(/<button\b/g)?.length, 1, markup)
    assert.ok(markup.includes(`aria-label="${kind}"`), markup)
  }
})

void test('queued items keep send, edit and delete actions in running and idle states', () => {
  for (const isStreaming of [true, false]) {
    const markup = renderToStaticMarkup(createElement(ConversationLocalizationProvider, {
      value: { locale: 'zh-CN', setLocale: async () => {}, t: (key) => key },
      children: createElement(ChatInputQueuePanel, {
      queuedDrafts: [{ id: 'queued', value: 'follow up', files: [] }],
      isStreaming, isQueueDraining: false,
      onQueuedDraftGuide: () => {}, onQueuedDraftRunNow: () => {},
      onQueuedDraftUpdate: () => {}, onQueuedDraftRemove: () => {},
      }),
    }))
    assert.equal(markup.match(/<button\b/g)?.length, 3, markup)
    assert.ok(markup.includes('follow up'), markup)
    assert.ok(!markup.includes('role="status"'), markup)
  }
})
