import React, { type ReactNode, StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import {
  ConversationBlockHooksProvider,
  emptyConversationBlockHooks,
} from '../../src/conversation/blocks/conversationBlockHooks'
import { MessageBubble } from '../../src/conversation/blocks/MessageBubble'
import { ThinkingBlock } from '../../src/conversation/blocks/MessageMarkdownBlocks'
import type { ChatMessage, ContentBlock } from '../../src/conversation/contracts'
import {
  ConversationLocalizationProvider,
  conversationZhCNMessages,
} from '../../src/conversation/i18n'
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
  renderMessage(message, running, !running)
}

function renderMessage(
  message: ChatMessage,
  running: boolean,
  completed = false,
  content?: ReactNode
): void {
  const messageId = message.id
  flushSync(() =>
    root.render(
      <StrictMode>
        <ConversationLocalizationProvider
          value={{
            locale: 'zh-CN',
            t: (key, params) => {
              const value = key
                .split('.')
                .reduce<unknown>(
                  (entry, part) => (entry as Record<string, unknown>)?.[part],
                  conversationZhCNMessages
                )
              return String(value ?? key).replace(/\{(\w+)\}/g, (_, token: string) =>
                String(params?.[token] ?? '')
              )
            },
          }}
        >
          <ConversationRenderSlotsProvider slots={slots}>
            <ConversationBlockHooksProvider value={emptyConversationBlockHooks}>
              <ConversationScrollFollowProvider scrollRef={scrollRef}>
                {content ?? (
                  <MessageBubble
                    key={messageId}
                    message={message}
                    sessionId="isolated"
                    isStreaming={running}
                    runMarker={
                      !completed
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
                )}
              </ConversationScrollFollowProvider>
            </ConversationBlockHooksProvider>
          </ConversationRenderSlotsProvider>
        </ConversationLocalizationProvider>
      </StrictMode>
    )
  )
}

function renderSteps(revision = 0, settled = false, withText = false): void {
  const blocks: ContentBlock[] = [
    {
      type: 'script-execution',
      id: 'first',
      kind: 'execute',
      title: '检查配置',
      status: 'succeeded',
      source: '',
      sourceTruncated: false,
      calls: [],
      durationMs: 10,
    },
    {
      type: 'tool-call',
      toolCallId: 'tool',
      toolName: 'project:run',
      title: `运行检查 ${revision}`,
      args: {},
      isRunning: !settled,
      error: settled ? '检查失败' : undefined,
    },
  ]
  if (revision > 0)
    blocks.push({
      type: 'script-execution',
      id: 'last',
      kind: 'execute',
      title: '准备校验',
      status: settled ? 'cancelled' : 'queued',
      source: '',
      sourceTruncated: false,
      calls: [],
      durationMs: null,
    })
  if (withText) blocks.push({ type: 'text', text: '说明保持可见' })
  renderMessage({ id: 'live-tools', role: 'assistant', timestamp: 1, blocks }, !settled)
}

function readSteps(): {
  expanded: string | null
  label: string
  cards: number
  hasText: boolean
  groups: number
} {
  const buttons = container.querySelectorAll('[data-slot="tool-activity-disclosure"] > button')
  return {
    expanded: buttons[0]?.getAttribute('aria-expanded') ?? null,
    label: buttons[0]?.textContent ?? '',
    cards: container.querySelectorAll(
      '[data-slot="script-execution"], [data-slot="tool-call-step"]'
    ).length,
    hasText: container.textContent?.includes('说明保持可见') ?? false,
    groups: buttons.length,
  }
}

function renderThinking(revision = 0, running = true, withTool = false): void {
  const block: ContentBlock = {
    type: 'thinking',
    text: revision === 0 ? '检查' : `检查配置。思考正文 ${revision}`,
  }
  const message: ChatMessage = {
    id: 'thinking-message',
    role: 'assistant',
    timestamp: 1,
    blocks: [block],
  }
  if (withTool)
    message.blocks.push({
      type: 'tool-call',
      toolCallId: 'thinking-tool',
      toolName: 'project:run',
      args: {},
      isRunning: true,
    })
  renderMessage(
    message,
    running,
    false,
    withTool ? undefined : (
      <ThinkingBlock
        key="thinking-proof"
        block={block}
        messageId={message.id}
        blockIndex={0}
        isStreaming={running}
      />
    )
  )
}

function readThinking(): { expanded: string | null; label: string; text: string | null } {
  const thinking = container.querySelector('[data-thinking-presentation="disclosure"]')
  return {
    expanded: thinking?.querySelector('button')?.getAttribute('aria-expanded') ?? null,
    label: thinking?.querySelector('button')?.textContent ?? '',
    text: thinking?.querySelector('pre')?.textContent ?? null,
  }
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
    renderSteps,
    renderThinking,
    readThinking,
    toggleThinking: (): void => {
      flushSync(() =>
        container
          .querySelector<HTMLButtonElement>('[data-thinking-presentation="disclosure"] > button')!
          .click()
      )
    },
    readSteps,
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
