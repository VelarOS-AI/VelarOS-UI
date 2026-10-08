import React, { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import {
  ConversationBlockHooksProvider,
  emptyConversationBlockHooks,
} from '../../src/conversation/blocks/conversationBlockHooks'
import { MessageBubble } from '../../src/conversation/blocks/MessageBubble'
import type { ChatMessage } from '../../src/conversation/contracts'
import { ConversationLocalizationProvider } from '../../src/conversation/i18n'
import {
  ConversationScrollFollowProvider,
  registerConversationScrollFollow,
} from '../../src/conversation/react-hooks/conversationScrollFollow'
import {
  ConversationRenderSlotsProvider,
  createConversationRenderSlots,
} from '../../src/conversation/render-slots'

// 可控绘制队列复现窗口暂停绘制；真正的 React、消息组件和 TimerScope 仍在 Electron 中运行。
const frames = new Map<number, FrameRequestCallback>()
let frameId = 0
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++frameId, callback)
  return frameId
}
globalThis.cancelAnimationFrame = (id) => {
  frames.delete(id)
}
const container = document.getElementById('root')!
const root = createRoot(container)
const scrollRef = { current: null }
let following = true
registerConversationScrollFollow(scrollRef, {
  isFollowingBottom: () => following,
})
const slots = createConversationRenderSlots({
  messageMarkdown: ({ text }) => <p>{text}</p>,
})

function render(messageId: string, running: boolean, revision = 0): void {
  const message: ChatMessage = {
    id: messageId,
    role: 'assistant',
    timestamp: 1,
    blocks: [
      {
        type: 'script-execution',
        id: 'step',
        kind: 'execute',
        title: 'Read source',
        status: running ? 'running' : 'succeeded',
        source: '',
        sourceTruncated: false,
        calls: [],
        durationMs: 10,
      },
      { type: 'text', text: `Complete ${revision}` },
    ],
  }
  flushSync(() =>
    root.render(
      <StrictMode>
        <ConversationLocalizationProvider value={{ locale: 'zh-CN', t: (key) => key }}>
          <ConversationRenderSlotsProvider slots={slots}>
            <ConversationBlockHooksProvider value={emptyConversationBlockHooks}>
              <ConversationScrollFollowProvider scrollRef={scrollRef}>
                <MessageBubble
                  key={messageId}
                  message={message}
                  sessionId="isolated"
                  isStreaming={running}
                  runMarker={
                    running
                      ? null
                      : {
                          messageId,
                          status: 'completed',
                          detail: null,
                          turnCount: 1,
                          turnKind: 'turn',
                          timestamp: 2,
                        }
                  }
                />
              </ConversationScrollFollowProvider>
            </ConversationBlockHooksProvider>
          </ConversationRenderSlotsProvider>
        </ConversationLocalizationProvider>
      </StrictMode>
    )
  )
}

async function flushFrames(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    for (const [id, callback] of [...frames.entries()]) {
      if (frames.delete(id)) flushSync(() => callback(performance.now()))
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function read(): { expanded: string | null; hasSummary: boolean } {
  const button = container.querySelector('[data-slot="tool-activity-disclosure"] > button')
  return {
    expanded: button?.getAttribute('aria-expanded') ?? null,
    hasSummary: container.textContent?.includes('Complete') ?? false,
  }
}

Object.assign(window, {
  processedActivityProof: {
    render,
    flushFrames,
    read,
    follow: (value: boolean): void => {
      following = value
    },
    toggle: (): void => {
      const button = container.querySelector<HTMLButtonElement>(
        '[data-slot="tool-activity-disclosure"] > button'
      )!
      flushSync(() => button.click())
    },
  },
})
