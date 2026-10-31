import { ChatTaskUsagePopover } from '@velaros-ai/ui/conversation'

import { componentLibraryRegistrySections } from '../../componentLibraryRegistrySections'
import { defineComponentLibraryEntry } from '../../componentLibraryRegistryTypes'

const labels = {
  title: '本次任务用量',
  requests: '请求数',
  input: '输入',
  output: '输出',
  cache: '缓存命中',
}
const total = {
  requests: 51,
  inputTokens: 2270595,
  outputTokens: 26335,
  cacheReadTokens: 2040960,
  incompleteRequests: 0,
  cacheMissingRequests: 0,
}
export default defineComponentLibraryEntry({
  ...componentLibraryRegistrySections.chatConversation,
  entryOrder: 22,
  entry: {
    id: 'chat-task-usage',
    name: 'ChatTaskUsagePopover',
    layer: 'Feature',
    status: 'ready',
    domain: 'Chat Conversation',
    source: '@velaros-ai/ui/conversation',
    origin: 'conversation/status/ChatTaskUsagePopover',
    exampleMode: 'fixture',
    usage:
      'Hover to show input, output, weighted cache hit rate and request count. Hosts supply deduplicated accounting and localized labels; hover numbers for exact values.',
    avoid:
      'Do not treat missing provider counts as zero or aggregate request percentages without weighting by input tokens.',
    examples: [
      {
        id: 'task-usage-complete',
        label: 'Input / output / cache hit',
        node: <ChatTaskUsagePopover locale="zh-CN" total={total} labels={labels} />,
      },
      {
        id: 'task-usage-incomplete',
        label: 'Incomplete provider accounting',
        node: (
          <ChatTaskUsagePopover
            locale="zh-CN"
            total={{ ...total, cacheMissingRequests: 1 }}
            labels={labels}
          />
        ),
      },
      {
        id: 'task-usage-empty',
        label: 'No requests yet',
        node: (
          <ChatTaskUsagePopover
            locale="zh-CN"
            total={{
              requests: 0,
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              incompleteRequests: 0,
              cacheMissingRequests: 0,
            }}
            labels={labels}
          />
        ),
      },
    ],
  },
})
