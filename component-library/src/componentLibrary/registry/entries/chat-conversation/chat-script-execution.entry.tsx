import {
  ScriptExecutionCardStatesExample,
  ScriptExecutionTranscriptExample,
} from '@catalog/examples/ChatScriptExecutionExamples'

import { componentLibraryRegistrySections } from '../../componentLibraryRegistrySections'
import { defineComponentLibraryEntry } from '../../componentLibraryRegistryTypes'

export default defineComponentLibraryEntry({
  ...componentLibraryRegistrySections.chatConversation,
  entryOrder: 15,
  entry: {
    id: 'chat-script-execution',
    name: 'Script Execution Card',
    layer: 'Feature',
    status: 'ready',
    domain: 'Chat Conversation',
    source: '@velaros-ai/ui/conversation',
    origin: 'packages/ui/src/conversation/cards',
    exampleMode: 'fixture',
    usage:
      'script-execution 块的呈现:一行说明这一步做什么并列出用到的模块;悬停标题行看执行的脚本源码,点开看每次能力调用的参数、返回与错误。旧会话的 tool-call 块用同一副外框的通用卡。',
    avoid:
      '不要把脚本卡塞进「调用了 N 次工具」的活动折叠,也不要按工具分类换图标或换卡;标题由宿主取好,界面只在为空时按模块与操作兜底。',
    examples: [
      {
        id: 'script-execution-states',
        label: 'ScriptExecutionCard · 编写中/运行中/成功/失败/已取消 · 手编 fixture',
        node: <ScriptExecutionCardStatesExample />,
      },
      {
        id: 'script-execution-transcript',
        label: '消息里的脚本卡与旧工具调用通用卡 · 手编 fixture',
        node: <ScriptExecutionTranscriptExample />,
      },
    ],
  },
})
