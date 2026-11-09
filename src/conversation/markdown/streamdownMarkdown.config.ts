/** 完整会话的插件装配；基础会话图不经过此模块。 */
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import type { PluginConfig } from 'streamdown'

export * from './streamdownMarkdownBase'

const math = createMathPlugin({
  singleDollarTextMath: true,
})

export const STREAMDOWN_MARKDOWN_PLUGINS = {
  cjk,
  code,
  math,
  mermaid,
} satisfies PluginConfig
