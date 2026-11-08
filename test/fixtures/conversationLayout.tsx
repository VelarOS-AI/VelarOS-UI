// 用途：真实会话壳与用户气泡的布局、主题和操作命中回归；剪贴板只记录，不访问系统内容。
import { type CSSProperties, type ReactElement, useRef } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { UserMessageBubble } from '../../src/conversation/blocks/UserMessageBubble'
import type { ChatMessage } from '../../src/conversation/contracts'
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
} from '../../src/conversation/i18n'
import type { ConversationRewindPlan, ConversationView } from '../../src/conversation/projection'
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
  t: (key) => key,
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

function Pane({ variant }: { variant: 'default' | 'side' }): ReactElement {
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
        conversation={conversation}
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
