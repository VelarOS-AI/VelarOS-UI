/**
 * HTML 制品的验收测试：每一条对应 spec/invariants.md 里的一个编号。
 * 只经根入口，只测对外承诺的行为；utils 里的实现细节在 test/ 下补。
 */

import vm from 'node:vm'

import { describe, expect, test } from 'bun:test'

import { HtmlArtifactDefaults, htmlArtifactDocuments } from '../index.js'

describe('沙箱文档', () => {
  test('INV-5 注入脚本里的缺省上限就是常量表里那两个数字', () => {
    const shell = htmlArtifactDocuments.buildShellDocument()
    const document = htmlArtifactDocuments.buildDocument('<main>hi</main>')
    const expected = `)(${HtmlArtifactDefaults.maxReportedHeight},${HtmlArtifactDefaults.maxWidthRatio});`

    expect(shell).toContain(expected)
    expect(document).toContain(expected)
    expect(shell).toContain(`id="${HtmlArtifactDefaults.rootId}"`)
    // 脚本里不再另抄一份：整份文档里出现的这两个数字只来自常量表插值。
    expect(htmlArtifactDocuments.buildShellDocument({ maxReportedHeight: 720 })).toContain(
      `)(720,${HtmlArtifactDefaults.maxWidthRatio});`
    )
  })

  test('INV-8 外链只放行 http / https，主动执行型、相对地址与空串一律给 null', () => {
    for (const url of ['javascript:alert(1)', '/relative', 'data:text/html,<b>x', '']) {
      expect(htmlArtifactDocuments.normalizeExternalUrl(url)).toBeNull()
    }
    expect(htmlArtifactDocuments.normalizeExternalUrl('https://example.com/docs')).toBe(
      'https://example.com/docs'
    )
  })
})

/** 从外壳文档里抠出 `<head>` 里那段桥接脚本。 */
function readBridgeHeadScript(): string {
  const html = htmlArtifactDocuments.buildShellDocument()
  const match = html.match(/<script>([\s\S]*?)<\/script><\/head>/u)
  expect(match?.[1]).toBeTruthy()
  return match?.[1] ?? ''
}

/** 一个假脚本元素：只有重跑逻辑读写的那几样。 */
function fakeScript(text: string, attributes: Record<string, string> = {}) {
  const attrs = new Map(Object.entries(attributes))
  const replaced: unknown[] = []
  return {
    text,
    src: '',
    replaced,
    parentNode: { replaceChild: (next: unknown) => replaced.push(next) },
    get attributes() {
      return [...attrs].map(([name, value]) => ({ name, value }))
    },
    getAttribute: (name: string) => attrs.get(name) ?? null,
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string, value: string) => attrs.set(name, value),
  }
}

/** 装上桥接脚本，按注册先后把错误事件交给 error 监听器；监听器叫停就不再往后传。 */
function createErrorBridgeHarness() {
  const listeners: Array<(event: unknown) => void> = []
  const messages: Array<Record<string, unknown>> = []
  const document: Record<string, unknown> = { currentScript: null, createElement: () => fakeScript('') }
  const window: Record<string, unknown> = {
    addEventListener(type: string, listener: (event: unknown) => void) {
      if (type === 'error') listeners.push(listener)
    },
    parent: { postMessage: (message: Record<string, unknown>) => messages.push(message) },
  }
  vm.runInNewContext(readBridgeHeadScript(), { document, window })

  const dispatch = (error: Error, script: ReturnType<typeof fakeScript>) => {
    document.currentScript = script
    let stopped = false
    let prevented = false
    const event = {
      error,
      message: error.message,
      preventDefault: () => (prevented = true),
      stopImmediatePropagation: () => (stopped = true),
    }
    for (const listener of listeners) {
      listener(event)
      if (stopped) break
    }
    return prevented
  }
  return { dispatch, messages }
}

describe('脚本重名重跑', () => {
  test('INV-9 顶层声明跟 window 上改不掉的名字同名、整段没跑的脚本，套一层块原位换掉再跑，这次的错不上报', () => {
    const { dispatch, messages } = createErrorBridgeHarness()
    const script = fakeScript('const top=el.offsetTop;draw(top)', { 'data-artifact-script': 'chart' })

    expect(dispatch(new SyntaxError("Identifier 'top' has already been declared"), script)).toBe(true)
    const [retry] = script.replaced as Array<ReturnType<typeof fakeScript>>
    expect(retry?.text).toBe('{const top=el.offsetTop;draw(top)\n}')
    expect(retry?.getAttribute('data-artifact-script')).toBe('chart')
    expect(retry?.hasAttribute('data-velaros-script-retry')).toBe(true)
    expect(messages).toEqual([])
  })

  test('INV-9 重跑的那份还失败才上报；跑到一半抛出的 SyntaxError、模块脚本和外链脚本都不重跑', () => {
    const { dispatch, messages } = createErrorBridgeHarness()
    const redeclared = new SyntaxError("Identifier 'x' has already been declared")
    const retried = fakeScript('{let x;let x\n}', { 'data-velaros-script-retry': 'true' })
    const parsing = fakeScript("const data=JSON.parse('{bad')")
    const module = fakeScript('const top=1', { type: 'module' })
    const external = Object.assign(fakeScript(''), { src: 'https://cdn.example/lib.js' })

    expect(dispatch(redeclared, retried)).toBe(false)
    expect(dispatch(new SyntaxError('Unexpected token b in JSON at position 1'), parsing)).toBe(false)
    expect(dispatch(redeclared, module)).toBe(false)
    expect(dispatch(redeclared, external)).toBe(false)
    for (const script of [retried, parsing, module, external]) expect(script.replaced).toEqual([])
    expect(messages).toHaveLength(4)
  })
})

/** 渲染运行时用到的那点 DOM。外壳脚本新建的 script 一插进树就记成「跑了一次」。 */
class FakeNode {
  public childNodes: FakeNode[] = []
  public parentNode: Nullable<FakeNode> = null
  public attributes: Array<{ name: string, value: string }> = []
  public executable = false

  public constructor(
    public readonly nodeType: number,
    public readonly nodeName: string,
    public nodeValue: Nullable<string>,
    private readonly runs: string[],
  ) {}

  public get firstChild(): Nullable<FakeNode> {
    return this.childNodes[0] ?? null
  }

  public get nextSibling(): Nullable<FakeNode> {
    const siblings = this.parentNode?.childNodes ?? []
    return siblings[siblings.indexOf(this) + 1] ?? null
  }

  public get text(): string {
    return this.childNodes.map((child) => child.nodeValue ?? '').join('')
  }

  public set text(value: string) {
    this.childNodes = []
    this.appendChild(new FakeNode(3, '#text', value, this.runs))
  }

  public get textContent(): string {
    return this.text
  }

  public getAttribute(name: string): Nullable<string> {
    return this.attributes.find((attr) => attr.name === name)?.value ?? null
  }

  public hasAttribute(name: string): boolean {
    return this.attributes.some((attr) => attr.name === name)
  }

  public setAttribute(name: string, value: string): void {
    this.removeAttribute(name)
    this.attributes.push({ name, value })
  }

  public removeAttribute(name: string): void {
    this.attributes = this.attributes.filter((attr) => attr.name !== name)
  }

  public appendChild(child: FakeNode): FakeNode {
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }

  public removeChild(child: FakeNode): FakeNode {
    this.childNodes.splice(this.childNodes.indexOf(child), 1)
    child.parentNode = null
    return child
  }

  public replaceChild(next: FakeNode, previous: FakeNode): FakeNode {
    this.childNodes[this.childNodes.indexOf(previous)] = next
    next.parentNode = this
    previous.parentNode = null
    if (next.executable) this.runs.push(next.text)
    return previous
  }

  public cloneNode(): FakeNode {
    const copy = new FakeNode(this.nodeType, this.nodeName, this.nodeValue, this.runs)
    copy.attributes = this.attributes.map((attr) => ({ ...attr }))
    for (const child of this.childNodes) copy.appendChild(child.cloneNode())
    return copy
  }

  /** 只认运行时用的那一个选择器：还没激活的 script。 */
  public querySelectorAll(): FakeNode[] {
    return this.childNodes.flatMap((child) => [
      ...(child.nodeName === 'SCRIPT' && !child.hasAttribute('data-velaros-script-activated') ? [child] : []),
      ...child.querySelectorAll(),
    ])
  }

  public dispatchEvent(): boolean {
    return true
  }
}

/** 装上外壳文档的尾部脚本；render(片段) 把一棵假 DOM 当作解析结果送进去，交回每段脚本跑过的次序。 */
function createRenderHarness() {
  const runs: string[] = []
  const node = (name: string, children: FakeNode[] = [], attributes: Record<string, string> = {}) => {
    const element = new FakeNode(1, name, null, runs)
    for (const [attr, value] of Object.entries(attributes)) element.setAttribute(attr, value)
    for (const child of children) element.appendChild(child)
    return element
  }
  const text = (value: string) => new FakeNode(3, '#text', value, runs)
  const root = node('DIV')
  let pending = node('#fragment')
  const listeners: Array<(event: unknown) => void> = []
  const parent = { postMessage: () => undefined }
  const document = {
    body: node('BODY'),
    documentElement: node('HTML'),
    getElementById: () => root,
    addEventListener: () => undefined,
    dispatchEvent: () => true,
    createElement: (name: string) => {
      if (name === 'template') return { set innerHTML(_html: string) {}, get content() { return pending } }
      const element = node(name.toUpperCase())
      element.executable = true
      return element
    },
  }
  const window = {
    parent,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (type === 'message') listeners.push(listener)
    },
    dispatchEvent: () => true,
  }
  const shell = htmlArtifactDocuments.buildShellDocument({ bridgeMessages: { render: 'test:render' } })
  const tail = [...shell.matchAll(/<script>([\s\S]*?)<\/script>/gu)]
    .map((match) => match[1] ?? '')
    .find((source) => source.includes('function render('))
  expect(tail).toBeTruthy()
  vm.runInNewContext(tail ?? '', { document, window, setTimeout: () => 0, Event: class {} })

  const render = (...children: FakeNode[]) => {
    pending = node('#fragment', children)
    for (const listener of listeners) listener({ source: parent, data: { type: 'test:render', html: '' } })
  }
  const script = (source: string) => node('SCRIPT', [text(source)])
  return { render, runs, root, node, text, script }
}

describe('外壳文档的渲染', () => {
  test('INV-9 跑过的脚本内容没变，再渲染（内容变长、宿主重发）不再跑第二遍', () => {
    const { render, runs, node, text, script } = createRenderHarness()

    render(node('DIV', [text('a')]), script('const data=1;draw(data)'))
    render(node('DIV', [text('a')]), script('const data=1;draw(data)'), node('P', [text('more')]))
    render(node('DIV', [text('a')]), script('const data=1;draw(data)'), node('P', [text('more')]))

    expect(runs).toEqual(['const data=1;draw(data)'])
  })

  test('INV-9 同一个位置换成了另一段脚本，换上新的一份再跑', () => {
    const { render, runs, root, node, text, script } = createRenderHarness()

    render(node('DIV', [text('a')]), script('draw(1)'))
    render(node('DIV', [text('b')]), script('draw(2)'))

    expect(runs).toEqual(['draw(1)', 'draw(2)'])
    expect(root.childNodes.map((child) => child.text)).toEqual(['b', 'draw(2)'])
  })
})
