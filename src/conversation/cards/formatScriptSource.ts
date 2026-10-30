import { Log } from '#internal/runtime'

/** 合并并发排版，反复开合复用结果；限制条目和单条源码，避免会话越长缓存越大。 */
const formattedSources = new Map<string, Promise<string>>()

/** 只在用户展开详情时加载排版器；超大或未完成的源码保持原文，执行与存档不受影响。 */
export async function formatScriptSource(source: string): Promise<string> {
  if (!source.trim() || source.length > 100_000) return source
  const cached = formattedSources.get(source)
  if (cached) return cached
  const result = formatSource(source)
  formattedSources.set(source, result)
  if (formattedSources.size > 16) formattedSources.delete(formattedSources.keys().next().value!)
  return result
}

async function formatSource(source: string): Promise<string> {
  try {
    const [prettier, babel, estree] = await Promise.all([
      import('prettier/standalone'), import('prettier/plugins/babel'), import('prettier/plugins/estree'),
    ])
    return (await prettier.format(source, {
      parser: 'babel-ts', plugins: [babel.default, estree.default],
      printWidth: 88, tabWidth: 2, singleQuote: true, semi: false,
    })).trimEnd()
  } catch (error) {
    Log.tag('script-source').debug('源码不能完整解析，保持原始展示', { reason: error instanceof Error ? error.message.slice(0, 100) : 'format failed' })
    return source
  }
}
