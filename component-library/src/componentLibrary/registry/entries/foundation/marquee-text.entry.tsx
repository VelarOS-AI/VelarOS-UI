import { componentLibraryRegistrySections } from '../../componentLibraryRegistrySections'
import { defineComponentLibraryEntry } from '../../componentLibraryRegistryTypes'

export default defineComponentLibraryEntry({
  ...componentLibraryRegistrySections.foundation,
  entryOrder: 42,
  entry: {
    id: 'marquee-text',
    name: 'Marquee Text',
    layer: 'UI',
    status: 'ready',
    domain: 'Main window',
    source: '@velaros-ai/ui',
    origin: 'src/primitives/display/MarqueeText',
    usage:
      '单行标题默认省略溢出部分。文字过长且 active 时，独立轨道横向循环滚动，标题行与悬停区域固定。系统减少动态效果时保持静态。字色 / 字号从父级继承。',
    avoid:
      '不要向内注入 className / style（封闭形态无逃生口）；单点外观走消费方本地包裹元素 + 继承，或对稳定类名 :global 覆盖。',
    examples: [],
    apiComponents: ['MarqueeText'],
  },
})
