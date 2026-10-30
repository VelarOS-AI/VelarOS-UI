import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { type ControlsConfig, defaultRehypePlugins, defaultUrlTransform, type LinkSafetyConfig, type PluginConfig, type StreamdownProps, type UrlTransform } from 'streamdown'

import { resolveMessageMarkdownHrefTarget } from './messageMarkdownLinks.utils'

import { isString } from '#internal/runtime'

export type StreamdownMarkdownMode = 'static' | 'streaming'

const math = createMathPlugin({
  singleDollarTextMath: true,
})

export const STREAMDOWN_MARKDOWN_PLUGINS = {
  cjk,
  code,
  math,
  mermaid,
} satisfies PluginConfig

export const STREAMDOWN_MARKDOWN_CONTROLS = {
  code: {
    copy: true,
    download: true,
  },
  mermaid: false,
  table: {
    copy: true,
    download: true,
    fullscreen: true,
  },
} satisfies ControlsConfig

export const STREAMDOWN_MARKDOWN_LINK_SAFETY = {
  enabled: false,
} satisfies LinkSafetyConfig

export function resolveStreamdownMarkdownMode({
  isStreaming,
}: {
  isStreaming: boolean
}): StreamdownMarkdownMode {
  return isStreaming ? 'streaming' : 'static'
}

// 保留 Streamdown 的 HTML 与链接过滤，仅扩展 anchor 的 href 协议。
type RehypePluginTuple = Extract<NonNullable<StreamdownProps['rehypePlugins']>[number], unknown[]>
const [sanitize, sanitizeOptions] = defaultRehypePlugins.sanitize as RehypePluginTuple
const sanitizeSchema = sanitizeOptions as { protocols?: Record<string, string[]> }
export const STREAMDOWN_MARKDOWN_REHYPE_PLUGINS = [
  defaultRehypePlugins.raw,
  rehypeMessageFileLinks,
  [sanitize, {
    ...sanitizeSchema,
    protocols: {
      ...sanitizeSchema.protocols,
      href: [...(sanitizeSchema.protocols?.href ?? []), 'file'],
    },
  }],
  rehypeMessageLinkHardening,
] satisfies NonNullable<StreamdownProps['rehypePlugins']>

export const transformMessageMarkdownUrl: UrlTransform = (url, key, node) => {
  if (key === 'href') {
    const target = resolveMessageMarkdownHrefTarget(url)
    if (target.kind === 'file') return target.uri
  }
  return defaultUrlTransform(url, key, node)
}

interface LinkNode {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: LinkNode[]
}

/** 在 sanitizer 把 Windows 盘符误当未知 scheme 丢弃前，归一化有效文件目标。 */
function rehypeMessageFileLinks() {
  return function visit(node: LinkNode): void {
    const href = node.properties?.href
    if (node.tagName === 'a' && isString(href)) {
      const target = resolveMessageMarkdownHrefTarget(href)
      if (target.kind === 'file') node.properties!.href = target.uri
    }
    node.children = node.children?.flatMap((child) => {
      visit(child)
      const href = child.properties?.href
      const target = child.tagName === 'a' && isString(href)
        ? resolveMessageMarkdownHrefTarget(href)
        : null
      const tail = child.children?.at(-1)
      const suffix = tail?.type === 'text' ? tail.value?.match(/\s+目录$/u)?.[0] : null
      if (target?.kind !== 'file' || !target.path.endsWith('/') || !suffix) return [child]
      tail!.value = tail!.value!.slice(0, -suffix.length)
      return [child, { type: 'text', value: suffix }]
    })
  }
}

/** 文件控件交给宿主打开，其他节点继续使用上游过滤链路。 */
function rehypeMessageLinkHardening() {
  const [harden, options] = defaultRehypePlugins.harden as RehypePluginTuple
  const hardenTree = (harden as (options: unknown) => (tree: LinkNode) => void)(options)
  return (tree: LinkNode): void => {
    const files: LinkNode[] = []
    const visit = (node: LinkNode): void => {
      const href = node.properties?.href
      if (node.tagName === 'a') {
        const target = isString(href) ? resolveMessageMarkdownHrefTarget(href) : null
        if (!target || target.kind === 'text') {
          // sanitizer 可能已移除不支持的 href；明确降级成文本，不让上游注入 [blocked]。
          node.tagName = 'span'
          node.properties = {}
        } else if (target.kind === 'file') {
          files.push(node)
          node.tagName = 'span'
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
    hardenTree(tree)
    for (const node of files) node.tagName = 'a'
  }
}
