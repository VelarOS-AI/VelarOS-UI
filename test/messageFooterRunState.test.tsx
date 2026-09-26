import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  type ConversationBlockHooks,
  ConversationBlockHooksProvider,
} from '../src/conversation/blocks/conversationBlockHooks'
import { shouldShowAssistantGeneratedArtifacts } from '../src/conversation/blocks/messageBubbleRenderModel'
import type { ChatMessage } from '../src/conversation/contracts'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
} from '../src/conversation/i18n'
import type {
  ConversationMessageRunMarker,
  ConversationRunMarkerStatus,
} from '../src/conversation/projection'
import { ChatTranscript } from '../src/conversation/shell/ChatTranscript'
import {
  buildChatTranscriptMessagePresentations,
  type ChatTranscriptMessagePresentationOptions,
} from '../src/conversation/shell/chatTranscriptActivityGrouping'

const localization: ConversationI18nContextValue = {
  locale: 'zh-CN',
  setLocale: async () => undefined,
  t: (key) => key,
}

const blockHooks: ConversationBlockHooks = {
  useAutoTranslateThinkingEnabled: () => false,
  useScriptLiveOutput: () => null,
  useMessageActionView: () => ({
    actionItems: [],
    actionRows: [],
    formatPathForDisplay: (path) => path,
    hasActionItems: false,
    openPathInLight: async () => undefined,
  }),
}

function message(
  id: string,
  role: ChatMessage['role'],
  conversationKind?: ChatMessage['conversationKind']
): ChatMessage {
  return { id, role, conversationKind, blocks: [{ type: 'text', text: `${id} 的正文` }], timestamp: 1 }
}

function marker(messageId: string, status: ConversationRunMarkerStatus): ConversationMessageRunMarker {
  return { messageId, status, detail: null, turnCount: 1, turnKind: 'turn', timestamp: 2 }
}

/** 按「谁在流式、谁带什么 marker」给出与 ChatTranscript 同一套判定入参。 */
function presentationOptions({
  streamingId = null,
  markers = {},
}: {
  streamingId?: Nullable<string>
  markers?: Record<string, ConversationRunMarkerStatus>
}): ChatTranscriptMessagePresentationOptions {
  return {
    isStreamingMessage: (entry) => entry.id === streamingId,
    hasRunMarker: (entry) => !!markers[entry.id],
    isRunEnd: (entry) => {
      const status = markers[entry.id]
      return !!status && status !== 'awaiting-input' && status !== 'awaiting-confirmation'
    },
    isRunPaused: (entry) =>
      markers[entry.id] === 'awaiting-input' || markers[entry.id] === 'awaiting-confirmation',
  }
}

/** 一条消息在 transcript 标记里的那一段：从它的 data-chat-message 到下一条之前。 */
function messageMarkup(markup: string, id: string): string {
  const start = markup.indexOf(`data-chat-message="${id}"`)
  assert.ok(start >= 0, `missing message ${id}`)
  const next = markup.indexOf('data-chat-message="', start + 1)
  return markup.slice(start, next < 0 ? undefined : next)
}

function inProgressIds(
  messages: ChatMessage[],
  options: ChatTranscriptMessagePresentationOptions
): string[] {
  return buildChatTranscriptMessagePresentations(messages, options)
    .filter((presentation) => presentation.runInProgress)
    .map((presentation) => presentation.message.id)
}

void describe('回答收尾件（复制与时间）什么时候出现', () => {
  void test('本条流式、或所属执行还在往后跑时都不出现；带标记的只在正常完成时出现', () => {
    assert.equal(shouldShowAssistantGeneratedArtifacts({ isStreaming: true }), false)
    assert.equal(shouldShowAssistantGeneratedArtifacts({ isStreaming: false, runInProgress: true }), false)
    assert.equal(shouldShowAssistantGeneratedArtifacts({ isStreaming: false, runMarker: null }), true)
    assert.equal(
      shouldShowAssistantGeneratedArtifacts({ isStreaming: false, runMarker: { status: 'completed' } }),
      true
    )
    assert.equal(
      shouldShowAssistantGeneratedArtifacts({ isStreaming: false, runMarker: { status: 'failed' } }),
      false
    )
  })

  void test('执行中途的助手消息既不流式也没有 marker，靠所属执行认出它还在跑', () => {
    const messages = [
      message('turn', 'user', 'turn-input'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
      message('a3', 'assistant'),
    ]

    assert.deepEqual(inProgressIds(messages, presentationOptions({ streamingId: 'a3' })), ['a1', 'a2', 'a3'])
    assert.deepEqual(inProgressIds(messages, presentationOptions({})), [])
  })

  void test('同一轮里上一次执行停下的消息及之前的不算这一次', () => {
    const messages = [
      message('turn', 'user', 'turn-input'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
      message('continue', 'user', 'system-notice'),
      message('a3', 'assistant'),
      message('a4', 'assistant'),
    ]

    assert.deepEqual(
      inProgressIds(messages, presentationOptions({ streamingId: 'a4', markers: { a2: 'completed' } })),
      ['continue', 'a3', 'a4']
    )
  })

  void test('等待作答只是暂停：暂停中与作答后接着跑都算同一次执行没停', () => {
    const paused = [
      message('turn', 'user', 'turn-input'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
    ]
    assert.deepEqual(
      inProgressIds(paused, presentationOptions({ markers: { a2: 'awaiting-input' } })),
      ['a1', 'a2']
    )

    const resumed = [...paused, message('reply', 'user', 'interaction-reply'), message('a3', 'assistant')]
    assert.deepEqual(
      inProgressIds(resumed, presentationOptions({ streamingId: 'a3', markers: { a2: 'awaiting-input' } })),
      ['a1', 'a2', 'reply', 'a3']
    )

    // 下一轮已经开始：上一轮的暂停不会再有人接着跑。
    assert.deepEqual(
      inProgressIds(
        [...paused, message('next', 'user', 'turn-input')],
        presentationOptions({ markers: { a2: 'awaiting-input' } })
      ),
      []
    )
  })

  void test('执行已经跑完时，残留在中途消息上的等待 marker 不会让整段继续藏着', () => {
    const messages = [
      message('turn', 'user', 'turn-input'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
      message('reply', 'user', 'interaction-reply'),
      message('a3', 'assistant'),
    ]

    assert.deepEqual(
      inProgressIds(messages, presentationOptions({ markers: { a2: 'awaiting-input', a3: 'completed' } })),
      []
    )
  })

  void test('运行中的会话里，前面的助手消息不出复制按钮；跑完后照常出现', () => {
    const messages = [
      message('turn', 'user', 'turn-input'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
    ]
    const renderTranscript = (streamingId: Nullable<string>, markers: Record<string, ConversationRunMarkerStatus>): string =>
      renderToStaticMarkup(
        createElement(
          ConversationLocalizationProvider,
          { value: localization },
          createElement(
            ConversationBlockHooksProvider,
            { value: blockHooks },
            createElement(ChatTranscript, {
              messages,
              sessionId: 'session',
              getIsStreaming: (entry) => entry.id === streamingId,
              getRunMarker: (entry) => {
                const status = markers[entry.id]
                return status ? marker(entry.id, status) : null
              },
            })
          )
        ) as ReactElement
      )

    const running = renderTranscript('a2', {})
    assert.doesNotMatch(messageMarkup(running, 'a1'), /chat\.copyAnswer/u)
    assert.doesNotMatch(messageMarkup(running, 'a2'), /chat\.copyAnswer/u)

    const completed = renderTranscript(null, { a2: 'completed' })
    assert.match(messageMarkup(completed, 'a1'), /chat\.copyAnswer/u)
    assert.match(messageMarkup(completed, 'a2'), /chat\.copyAnswer/u)
  })

  void test('被停下的运行没写出正文时，状态角标单独画一行；有正文时照旧挂在正文末尾', () => {
    const scriptOnly: ChatMessage = {
      id: 'stopped',
      role: 'assistant',
      timestamp: 1,
      blocks: [
        {
          type: 'script-execution',
          id: 'script-1',
          kind: 'execute',
          turnId: 'turn-1',
          status: 'failed',
          source: '// 分步实现',
          sourceTruncated: false,
          calls: [],
          error: '第 3 行：add test failed',
          durationMs: 348,
        },
      ],
    }
    const render = (target: ChatMessage): string =>
      renderToStaticMarkup(
        createElement(
          ConversationLocalizationProvider,
          { value: localization },
          createElement(
            ConversationBlockHooksProvider,
            { value: blockHooks },
            createElement(ChatTranscript, {
              messages: [message('turn', 'user', 'turn-input'), target],
              sessionId: 'session',
              getRunMarker: (entry) => (entry.id === target.id ? marker(entry.id, 'aborted') : null),
            })
          )
        ) as ReactElement
      )

    assert.match(messageMarkup(render(scriptOnly), 'stopped'), /aria-label="status\.aborted/u)
    // 有正文：角标由正文末尾的槽位挂（挂载后经 portal 放进去，静态渲染里还没有），不另起一行
    const withText = messageMarkup(render(message('answered', 'assistant')), 'answered')
    assert.doesNotMatch(withText, /aria-label="status\.aborted/u)
  })
})
