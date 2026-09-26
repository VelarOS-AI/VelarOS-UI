import { expect, test } from 'bun:test'

import { resolveChatMessageConversationKind } from '../src/conversation/contracts/conversation'

test('input projection preserves accepted conversation kinds', () => {
  expect(resolveChatMessageConversationKind({ role: 'user', conversationKind: 'run-guidance' })).toBe('run-guidance')
  expect(resolveChatMessageConversationKind({ role: 'user', conversationKind: 'turn-input' })).toBe('turn-input')
})
