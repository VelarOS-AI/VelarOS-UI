export type MessageMarkdownHrefTarget =
  | { kind: 'web'; url: string }
  | { kind: 'external-protocol'; url: string }
  | { kind: 'file'; uri: string; path: string }
  | { kind: 'text'; text: string }

/** Markdown 目标接受显式 URI 与本地绝对路径；普通正文和代码不经过这里。 */
export function resolveMessageMarkdownHrefTarget(href: string): MessageMarkdownHrefTarget {
  const text = { kind: 'text', text: href } as const
  const pathUri = absolutePathUri(href)
  if (pathUri) return resolveMessageMarkdownHrefTarget(pathUri)
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

/** 兼容模型的绝对路径链接，转成统一的 file URI 后仍走同一校验与宿主打开入口。 */
function absolutePathUri(href: string): Nullable<string> {
  const windows = /^[A-Za-z]:[/\\](?![/\\])/u.test(href)
  if (!windows && !/^\/(?!\/)/u.test(href)) return null
  if (/\p{Cc}/u.test(href) || /%(?:2f|5c|00)/iu.test(href)) return null
  const normalized = windows ? href.replaceAll('\\', '/') : href
  if (normalized.includes('\\')) return null
  try {
    // Markdown 解析器会编码空格与中文；只解码一次，裸百分号视为文件名字符。
    const decoded = decodeURIComponent(normalized.replace(/%(?![a-f\d]{2})/giu, '%25'))
    if (/\p{Cc}/u.test(decoded)) return null
    const encoded = decoded.split('/').map((part) => encodeURIComponent(part)).join('/')
    return windows
      ? `file:///${encoded.replace(/^([A-Za-z])%3A\//u, '$1:/')}`
      : `file://${encoded}`
  } catch {
    // arch-guard:silent-catch-ok 不合法的编码只降级为普通文本，不猜测文件位置。
    return null
  }
}
