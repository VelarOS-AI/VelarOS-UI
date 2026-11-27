// 用途：真实会话壳与用户气泡的布局、主题和操作命中回归；剪贴板只记录，不访问系统内容。
import { type CSSProperties, type ReactElement, useRef } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import {
  ConversationBlockHooksProvider,
  emptyConversationBlockHooks,
} from '../../src/conversation/blocks/conversationBlockHooks'
import { UserMessageBubble } from '../../src/conversation/blocks/UserMessageBubble'
import type { ChatMessage } from '../../src/conversation/contracts'
import {
  conversationEnUSMessages,
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
} from '../../src/conversation/i18n'
import type {
  ConversationMessageRunMarker,
  ConversationRewindPlan,
  ConversationView,
} from '../../src/conversation/projection'
import { ChatConversationPane } from '../../src/conversation/shell/ChatConversationPane'
import {
  ConversationActionPortProvider,
  emptyConversationActionPort,
} from '../../src/conversation/shell/conversationActionPort'

import '../../src/styles/tokens/design-tokens.css'
import '../../src/styles/components/index.css'

const root = createRoot(document.getElementById('root')!)
const copied: string[] = []
const rewound: string[] = []
const i18n: ConversationI18nContextValue = {
  locale: 'en-US',
  setLocale: async () => {},
  t: (key, params) =>
    key === 'status.reconnecting'
      ? conversationEnUSMessages.status.reconnecting
          .replace('{attempt}', String(params?.attempt))
          .replace('{count}', String(params?.count))
      : key,
}
const conversation: ConversationView = {
  sessionId: 'layout-fixture',
  activeMemberSessionId: 'layout-fixture',
  messages: [],
  messageRunMarkers: [],
  supportsProjectFiles: false,
  isStreaming: false,
  hasStreamingThinkingBlock: false,
  runningLabel: '',
  runtime: {
    status: 'idle',
    teamPhase: null,
    activeTurn: null,
    completedTurns: 0,
    lastError: null,
    connectionRetryAttempt: null,
    connectionRetryMaxAttempts: null,
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    awaitingConfirmationMessage: null,
    awaitingInputQuestion: null,
    awaitingConfirmationExecutionId: null,
    conversationCards: [],
    usageTelemetry: [],
  },
}
const messages: ChatMessage[] = ['first', 'second'].map((id, index) => ({
  id,
  role: 'user',
  conversationKind: 'turn-input',
  timestamp: 1700000000000 + index,
  blocks: [{ type: 'text', text: 'First line\nSecond line' }],
}))
const rewindPlan: ConversationRewindPlan = {
  removedMessageCount: 1,
  removedTurnCount: 1,
  toolCallCount: 0,
  files: { kind: 'out-of-scope' },
}

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (value: string) => {
      copied.push(value)
    },
    write: async (items: ClipboardItem[]) => {
      for (const item of items) copied.push(await (await item.getType('text/plain')).text())
    },
  },
})

function Pane({
  variant,
  view = conversation,
}: {
  variant: 'default' | 'side'
  view?: ConversationView
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div
      id={`pane-${variant}`}
      style={{
        width: variant === 'side' ? 360 : 700,
        height: 100,
        display: 'flex',
      }}
    >
      <ChatConversationPane
        conversation={view}
        composer={null}
        followLocked={false}
        scrollRef={scrollRef}
        variant={variant}
        scrollNavigatorHidden
        onFollowLockedChange={() => {}}
      />
    </div>
  )
}

function renderResumedRun(
  phase: 'starting' | 'reconnecting' | 'executing' | 'completed',
  maxAttempts: Nullable<number> = null
): void {
  const isStreaming = phase !== 'completed'
  const hasOutput = phase === 'executing' || phase === 'completed'
  const interruptedMarker: ConversationMessageRunMarker = {
    messageId: 'interrupted',
    status: 'failed',
    detail: 'Connection interrupted',
    turnCount: null,
    turnKind: null,
    timestamp: 3,
  }
  const view: ConversationView = {
    ...conversation,
    messages: [
      { ...messages[0]!, id: 'task' },
      {
        id: 'interrupted',
        role: 'assistant',
        blocks: [
          { type: 'thinking', text: 'Initial activity' },
          { type: 'text', text: 'Connection interrupted', tone: 'error' },
        ],
        timestamp: 2,
      },
      { ...messages[1]!, id: 'continue', conversationKind: 'run-guidance', guidanceStatus: 'sent' },
    ],
    messageRunMarkers: [interruptedMarker],
    isStreaming,
    streamingAssistantMessageId: isStreaming && hasOutput ? 'resumed' : undefined,
    runtime: {
      ...conversation.runtime,
      status: isStreaming ? 'running' : 'completed',
      teamPhase: phase === 'starting' ? 'creating-task' : 'executing',
      connectionRetryAttempt: phase === 'reconnecting' ? 1 : null,
      connectionRetryMaxAttempts: maxAttempts,
    },
  }
  if (hasOutput)
    view.messages.push({
      id: 'resumed',
      role: 'assistant',
      blocks: [
        { type: 'thinking', text: 'Resumed activity' },
        { type: 'text', text: 'Final answer' },
      ],
      timestamp: 4,
    })
  if (!isStreaming)
    view.messageRunMarkers.push({
      ...interruptedMarker,
      messageId: 'resumed',
      status: 'completed',
      detail: null,
      timestamp: 5,
    })
  flushSync(() =>
    root.render(
      <ConversationLocalizationProvider value={i18n}>
        <ConversationBlockHooksProvider value={emptyConversationBlockHooks}>
          <ConversationActionPortProvider value={emptyConversationActionPort}>
            <Pane variant="default" view={view} />
          </ConversationActionPortProvider>
        </ConversationBlockHooksProvider>
      </ConversationLocalizationProvider>
    )
  )
}

function Harness({ custom, width }: { custom: boolean; width: number }): ReactElement {
  const style = custom
    ? ({
        '--chat-user-message-line-height': '1.55',
        '--chat-message-gap': '16px',
      } as CSSProperties)
    : undefined
  return (
    <ConversationLocalizationProvider value={i18n}>
      <ConversationActionPortProvider value={emptyConversationActionPort}>
        <div style={style}>
          <Pane variant="default" />
          <Pane variant="side" />
          <section
            id="messages"
            style={{
              width,
              containerName: 'chat-conversation-body',
              containerType: 'inline-size',
            }}
          >
            {messages.map((message) => (
              <UserMessageBubble
                key={message.id}
                message={message}
                onRewindToMessage={async (id) => {
                  rewound.push(id)
                }}
                getRewindPlan={() => rewindPlan}
              />
            ))}
          </section>
        </div>
      </ConversationActionPortProvider>
    </ConversationLocalizationProvider>
  )
}

function element(selector: string): HTMLElement {
  const result = document.querySelector<HTMLElement>(selector)
  if (!result) throw new Error(`Missing layout element: ${selector}`)
  return result
}
function rect(element: HTMLElement) {
  const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
  return { left, right, top, bottom, width, height }
}
function messageElement(id = 'first'): HTMLElement {
  return element(`[data-message-id="${id}"]`)
}
function button(kind: 'copy' | 'rewind'): HTMLElement {
  const selector =
    kind === 'copy' ? '.velar-copy-button' : '[aria-label="chat.rewindToBeforeMessage"]'
  const result = messageElement().querySelector<HTMLElement>(selector)
  if (!result) throw new Error(`Missing message action: ${kind}`)
  return result
}

Object.assign(window, {
  conversationLayoutProof: {
    render(custom = false, width = 700) {
      flushSync(() => root.render(<Harness custom={custom} width={width} />))
    },
    renderResumedRun,
    measureResumedRun() {
      const pane = element('#pane-default')
      const statuses = [
        ...pane.querySelectorAll<HTMLElement>('[class*="inlineNoticeRunning"][title]'),
      ]
      return {
        userBottom: pane.querySelector('[data-message-id="continue"]')?.getBoundingClientRect()
          .bottom,
        statuses: statuses.map((entry) => ({ top: rect(entry).top, text: entry.title })),
        processedCount: [
          ...pane.querySelectorAll('[data-slot="tool-activity-disclosure"] > button'),
        ].filter((entry) => entry.textContent?.includes('chat.processedActivity')).length,
        hasInterruptedMessage: !!pane.querySelector('[data-message-id="interrupted"]'),
        hasFailedMarker: !!pane.querySelector('[aria-label="status.failed"]'),
        hasFinalAnswer: pane.textContent?.includes('Final answer'),
      }
    },
    expandProcessedRun() {
      element('[data-slot="tool-activity-disclosure"] > button').click()
    },
    frame: () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    measure() {
      const first = messageElement()
      const paragraph = first.querySelector('p')!
      const time = first.querySelector('time')!
      return {
        mainGap: getComputedStyle(
          element('#pane-default [data-tour-id="chat-output"]').firstElementChild!
        ).gap,
        sideGap: getComputedStyle(
          element('#pane-side [data-tour-id="chat-output"]').firstElementChild!
        ).gap,
        fontSize: getComputedStyle(paragraph).fontSize,
        lineHeight: getComputedStyle(paragraph).lineHeight,
        first: rect(first),
        second: rect(messageElement('second')),
        paragraph: rect(paragraph),
        bubble: rect(paragraph.parentElement!),
        time: rect(time),
        timeOpacity: getComputedStyle(time).opacity,
        copied: [...copied],
        rewound: [...rewound],
      }
    },
    actionPoints(kind: 'copy' | 'rewind') {
      const target = button(kind).getBoundingClientRect()
      const copy = button('copy').getBoundingClientRect()
      const bubble = messageElement().querySelector('p')!.parentElement!.getBoundingClientRect()
      const y = target.top + target.height / 2
      return {
        bubble: { x: bubble.left + 4, y },
        bridge: { x: (copy.right + bubble.left) / 2, y },
        action: { x: target.left + target.width / 2, y },
      }
    },
    actionAtPoint(kind: 'copy' | 'rewind', point: { x: number; y: number }) {
      const hit = document.elementFromPoint(point.x, point.y)
      const target = button(kind)
      return {
        hit: hit === target || (!!hit && target.contains(hit)),
        opacity: getComputedStyle(target.parentElement!).opacity,
      }
    },
    confirmPoint() {
      const confirm = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
        (candidate) => candidate.textContent?.trim() === 'chat.rewindConfirmAction'
      )
      if (!confirm) throw new Error('The real rewind dialog did not open')
      const { left, top, width, height } = confirm.getBoundingClientRect()
      return { x: left + width / 2, y: top + height / 2 }
    },
  },
})
