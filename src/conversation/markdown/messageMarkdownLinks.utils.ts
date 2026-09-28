export type MessageMarkdownHrefTarget =
  | { kind: 'web'; url: string }
  | { kind: 'external-protocol'; url: string }
  | { kind: 'file'; uri: string; path: string }
  | { kind: 'text'; text: string }

/** 仅显式 URI 具有链接语义，路径与代码保持普通文本。 */
export function resolveMessageMarkdownHrefTarget(href: string): MessageMarkdownHrefTarget {
  const text = { kind: 'text', text: href } as const
  // WHATWG URL 会自动去除控制字符和修复反斜杠；先要求输入是明确的 URI。
  if (!href || /[\s\\]|\p{Cc}/u.test(href) || !URL.canParse(href)) return text
  const url = new URL(href)
  if (/^https?:\/\//iu.test(href) && url.hostname && !url.username && !url.password)
    return { kind: 'web', url: url.href }
  if (/^(?:mailto:|tel:)/iu.test(href)) return { kind: 'external-protocol', url: url.href }
  if (!/^file:\/\/(?:localhost)?\//iu.test(href) || url.hostname || url.pathname.startsWith('//') || url.search || url.hash)
    return text
  // 拒绝编码后的分隔符和 NUL，UTF-8 路径只解码一次。
  if (/%(?:2f|5c|00)/iu.test(url.pathname)) return text
  try {
    const decoded = decodeURIComponent(url.pathname)
    if (/\p{Cc}/u.test(decoded)) return text
    const path = /^\/[A-Za-z]:\//u.test(decoded) ? decoded.slice(1) : decoded
    return { kind: 'file', uri: url.href, path }
  } catch {
    // arch-guard:silent-catch-ok 非法 UTF-8 转义明确降级为文本，不能让坏链接中断整个回答渲染。
    return text
  }
}
