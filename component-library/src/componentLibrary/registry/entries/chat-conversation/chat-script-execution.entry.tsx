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
    origin: 'src/conversation/cards',
    exampleMode: 'fixture',
    usage:
      'script-execution 块的呈现:左侧命令图标(execute)或搜索图标(observe,标题前标出方法名),一句话说明这一步做什么并列出用到的模块,状态看整张卡的底色;收起时悬停标题行看源码,点开看执行的代码与每次调用的结果,都按语法着色。旧会话的 tool-call 块用同一副外框的通用卡。',
    avoid:
      '连续工具和脚本默认收在轻量状态摘要中,不要因进度刷新强制展开,也不要把需要用户操作的确认卡藏进去;标题由宿主取好,界面只在为空时按模块与操作兜底。',
    examples: [
      {
        id: 'script-execution-states',
        label: 'ScriptExecutionCard · 编写中/运行中/成功/失败/已取消/观察 · 手编 fixture',
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
