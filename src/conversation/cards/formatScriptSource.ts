import { Log } from '#internal/runtime'

/** 只在用户展开详情时加载排版器；超大或未完成的源码保持原文，执行与存档不受影响。 */
export async function formatScriptSource(source: string): Promise<string> {
  if (!source.trim() || source.length > 100_000) return source
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
