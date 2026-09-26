/** 沙箱文档的实现细节测试：源码归一化、frame 适配、外壳脚本、尺寸控制器与滚轮桥。 */

import vm from 'node:vm'

import { describe, expect, test } from 'bun:test'

import {
  HtmlArtifactBridgeMessageTypes,
  HtmlArtifactDefaults,
  htmlArtifactDocuments,
} from '../index.js'
import { HTML_ARTIFACT_SIZE_CONTROLLER_FACTORY_SOURCE } from '../utils/size-controller.js'

/** 一次尺寸测量的高度输入。 */
interface HeightMeasurement {
  baseHeight: number
  clientHeight: number
  scrollHeight: number
}

/** 一次尺寸测量的宽度输入。 */
interface WidthMeasurement {
  baseWidth: number
  clientWidth: number
}

/** 注入脚本里那个控制器的对外形状。 */
interface SizeController {
  invalidate: () => void
  resolve: (measurement: HeightMeasurement) => number
  resolveWidth: (measurement: WidthMeasurement) => number
  shouldPublish: (size: { height: number, width: number }) => boolean
}

/** 把注入脚本里的控制器工厂真的跑起来，测的正是生产用的那一份源码。 */
function createSizeController(maxReportedHeight: number, maxWidthRatio?: number): SizeController {
  const factory = Function(`return (${HTML_ARTIFACT_SIZE_CONTROLLER_FACTORY_SOURCE})`)() as (
    height: number,
    ratio?: number,
  ) => SizeController
  return factory(maxReportedHeight, maxWidthRatio)
}

/** 从外壳文档里抠出 `<head>` 里那段桥接脚本。 */
function readBridgeHeadScript(): string {
  const html = htmlArtifactDocuments.buildShellDocument()
  const match = html.match(/<script>([\s\S]*?)<\/script><\/head>/u)
  expect(match?.[1]).toBeTruthy()
  return match?.[1] ?? ''
}

/** 在一个假 iframe 里装上桥接脚本，返回拿到的 wheel 监听器与发给宿主的消息。 */
function createWheelBridgeHarness({
  embedded,
  rootScrollable = false,
}: {
  embedded: boolean
  rootScrollable?: boolean
}) {
  const registrations = new Map<string, { listener: (event: unknown) => void, options?: { capture?: boolean, passive?: boolean } }>()
  const messages: Array<Record<string, unknown>> = []
  const parentWindow = {
    postMessage(message: Record<string, unknown>) {
      messages.push(structuredClone(message))
    },
  }
  const iframeWindow: Record<string, unknown> = {
    addEventListener(
      type: string,
      listener: (event: unknown) => void,
      options?: { capture?: boolean, passive?: boolean }
    ) {
      registrations.set(type, { listener, options })
    },
    // 假元素把自己的样式挂在 style 上
    getComputedStyle: (node: { style?: Record<string, string> }) => node.style ?? {},
  }
  iframeWindow.parent = embedded ? parentWindow : iframeWindow

  vm.runInNewContext(readBridgeHeadScript(), {
    document: {
      documentElement: {
        clientHeight: 240,
        clientWidth: 320,
        scrollHeight: rootScrollable ? 480 : 240,
        scrollWidth: 320,
      },
    },
    window: iframeWindow,
  })

  const registration = registrations.get('wheel')
  expect(registration).toBeDefined()
  return { messages, registration: registration! }
}

describe('源码归一化与外链', () => {
  test('只剥掉包住整段源码的外层包装，普通 HTML 原样不动', () => {
    expect(htmlArtifactDocuments.normalizeSource('<main>Ready</main>')).toBe('<main>Ready</main>')
    expect(htmlArtifactDocuments.normalizeSource('<![CDATA[<style>body{color:red}</style>]]>')).toBe(
      '<style>body{color:red}</style>'
    )
    expect(htmlArtifactDocuments.normalizeSource('```html\n<svg></svg>\n```')).toBe('<svg></svg>')
    expect(htmlArtifactDocuments.inferContentKind('```svg\n<svg></svg>\n```')).toBe('svg')
  })

  test('只放行显式的 http / https，主动执行型与相对地址一律拒绝', () => {
    expect(htmlArtifactDocuments.normalizeExternalUrl('https://example.com/a')).toBe(
      'https://example.com/a'
    )
    expect(htmlArtifactDocuments.normalizeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(htmlArtifactDocuments.normalizeExternalUrl('/relative')).toBeNull()
  })
})

describe('frame 适配', () => {
  test('按宽度比例把自然尺寸缩进宿主视口', () => {
    expect(
      htmlArtifactDocuments.resolveFrameFit({
        fallbackHeight: 360,
        maxViewportWidth: 600,
        naturalHeight: 800,
        naturalWidth: 1200,
      })
    ).toEqual({
      contentHeight: 800,
      contentWidth: 1200,
      locked: true,
      scale: 0.5,
      viewportHeight: 400,
      viewportWidth: 600,
    })
  })

  test('过宽的内容停止缩放，不把正文压成细条', () => {
    const fit = htmlArtifactDocuments.resolveFrameFit({
      fallbackHeight: 360,
      maxViewportWidth: 600,
      naturalHeight: 800,
      naturalWidth: 6000,
    })

    expect(fit.scale).toBe(1)
    expect(fit.viewportWidth).toBe(600)
    expect(fit.viewportHeight).toBe(800)
  })
})

describe('外壳文档', () => {
  test('外壳可配置且产品中立', () => {
    const shell = htmlArtifactDocuments.buildShellDocument({
      bridgeMessages: {
        render: 'demo-render',
        generic: 'demo-message',
      },
      maxReportedHeight: 720,
      rootId: 'demo-root',
    })

    expect(shell).toMatch(/id="demo-root"/)
    expect(shell).toMatch(/demo-render/)
    expect(shell).toMatch(/demo-message/)
    expect(shell).toMatch(/window\.artifactBridge/)
    expect(shell).toMatch(new RegExp(HtmlArtifactBridgeMessageTypes.wheel))
    expect(shell).toMatch(/\)\(720,3\);function invalidateHeightMeasurement/)
    expect(shell).toMatch(/invalidateHeightMeasurement\(\);render\(data\.html\);hasRendered=true/)
    expect(shell).toMatch(/shouldPublishMeasuredSize/)
    expect(shell).not.toMatch(/widgetBridge|show_widget/)
  })

  test('viewport 耦合的制品有一个有限的缺省高度上限', () => {
    const shell = htmlArtifactDocuments.buildShellDocument()

    expect(HtmlArtifactDefaults.maxReportedHeight).toBe(1200)
    expect(HtmlArtifactDefaults.maxWidthRatio).toBe(3)
    expect(shell).toMatch(/\)\(1200,3\);function invalidateHeightMeasurement/)
  })
})

describe('尺寸控制器', () => {
  test('收缩、反馈冻结、去重与硬上限都在一个控制器里收敛', () => {
    const controller = createSizeController(720)

    expect(controller.resolve({ baseHeight: 2000, clientHeight: 240, scrollHeight: 2000 })).toBe(720)

    controller.invalidate()
    expect(controller.resolve({ baseHeight: 352, clientHeight: 376, scrollHeight: 352 })).toBe(352)
    expect(controller.shouldPublish({ height: 352, width: 560 })).toBe(true)
    expect(controller.shouldPublish({ height: 352, width: 560 })).toBe(false)

    controller.invalidate()
    expect(controller.resolve({ baseHeight: 300, clientHeight: 240, scrollHeight: 300 })).toBe(300)
    expect(controller.resolve({ baseHeight: 360, clientHeight: 300, scrollHeight: 360 })).toBe(360)
    expect(controller.resolve({ baseHeight: 420, clientHeight: 360, scrollHeight: 420 })).toBe(360)
    expect(controller.resolve({ baseHeight: 480, clientHeight: 420, scrollHeight: 480 })).toBe(360)
  })

  test('宽度随宿主给回来的 frame 长时冻结，且冻结是粘滞的', () => {
    const controller = createSizeController(1200, 3)

    // 100vw 子元素 / 百分比定位的装饰：宿主每加宽一次，测量宽就跟着长一次。
    expect(controller.resolveWidth({ baseWidth: 792, clientWidth: 760 })).toBe(792)
    expect(controller.resolveWidth({ baseWidth: 824, clientWidth: 792 })).toBe(824)
    expect(controller.resolveWidth({ baseWidth: 856, clientWidth: 824 })).toBe(760)
    // 冻结是粘滞的：DOM 变更不得解冻，否则每次 mutation 都会重启这条跑飞回路。
    controller.invalidate()
    expect(controller.resolveWidth({ baseWidth: 1600, clientWidth: 760 })).toBe(760)
  })

  test('真实宽的版式保留，跑飞的宽度被硬上限兜住', () => {
    // 定宽 1400 的设计稿：宿主加宽后测量宽不再长，是真实需求宽，原样回传由宿主缩放。
    const stable = createSizeController(1200, 3)
    expect(stable.resolveWidth({ baseWidth: 1432, clientWidth: 760 })).toBe(1432)
    expect(stable.resolveWidth({ baseWidth: 1432, clientWidth: 1432 })).toBe(1432)

    // 一步跳到 3 倍以上：来不及攒够两轮证据，硬上限直接兜住。
    const capped = createSizeController(1200, 3)
    expect(capped.resolveWidth({ baseWidth: 9000, clientWidth: 760 })).toBe(2280)
  })
})

/** 制品里的一个滚动容器：给了哪个方向的 overflow、多大的内容与视口、滚到了哪。 */
function scrollBox(box: {
  overflowX?: string
  overflowY?: string
  scrollWidth?: number
  clientWidth?: number
  scrollLeft?: number
  scrollHeight?: number
  clientHeight?: number
  scrollTop?: number
}) {
  return {
    nodeType: 1,
    parentElement: null,
    style: { overflowX: box.overflowX ?? 'visible', overflowY: box.overflowY ?? 'visible' },
    scrollWidth: box.scrollWidth ?? 100,
    clientWidth: box.clientWidth ?? 100,
    scrollLeft: box.scrollLeft ?? 0,
    scrollHeight: box.scrollHeight ?? 100,
    clientHeight: box.clientHeight ?? 100,
    scrollTop: box.scrollTop ?? 0,
  }
}

/** 从静态制品文档里抠出量尺寸的那段尾部脚本。 */
function readResizeTailScript(): string {
  const html = htmlArtifactDocuments.buildDocument('<div></div>')
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)]
    .map((match) => match[1] ?? '')
    .find((source) => source.includes('function measureContentSize'))
  expect(script).toBeTruthy()
  return script ?? ''
}

/** 在假页面里跑一遍量尺寸的脚本：body 下是给定的顶层元素，交回发给宿主的第一次尺寸。 */
function measureWithFakePage(children: Array<Record<string, unknown>>) {
  const messages: Array<Record<string, unknown>> = []
  const box = (width: number, height: number) => ({ width, height, bottom: height, right: width, top: 0, left: 0 })
  const body = {
    children,
    scrollWidth: 600,
    scrollHeight: 120,
    offsetWidth: 600,
    offsetHeight: 120,
    getBoundingClientRect: () => box(600, 120),
    style: { overflowX: 'visible', overflowY: 'visible', paddingBottom: '0', marginBottom: '0', borderBottomWidth: '0' },
  }
  const window: Record<string, unknown> = {
    innerWidth: 600,
    innerHeight: 400,
    parent: { postMessage: (message: Record<string, unknown>) => messages.push(message) },
    addEventListener: () => undefined,
    getComputedStyle: (node: { style?: Record<string, string> }) => node.style ?? {},
  }
  vm.runInNewContext(readResizeTailScript(), {
    document: { body, documentElement: { clientWidth: 600, clientHeight: 400, scrollWidth: 600, scrollHeight: 400 } },
    window,
    setTimeout: (callback: () => void) => callback(),
  })
  return messages[0]
}

describe('量尺寸', () => {
  test('溢出在自己里面滚动的元素（横向滚动的图表、限高的表格）只算它排版占的大小，框不会被按里面的宽缩小、也不会撑高', () => {
    const chart = {
      style: { overflowX: 'auto', overflowY: 'auto' },
      scrollWidth: 2400,
      scrollHeight: 900,
      offsetWidth: 600,
      offsetHeight: 80,
      getBoundingClientRect: () => ({ width: 600, height: 80, bottom: 80, right: 600, top: 0, left: 0 }),
    }
    const size = measureWithFakePage([chart])
    expect(size).toMatchObject({ naturalWidth: 600, naturalHeight: 80 })
  })

  test('溢出可见的元素照旧算上溢出：真正超宽的版式交给宿主缩放', () => {
    const poster = {
      style: { overflowX: 'visible', overflowY: 'visible' },
      scrollWidth: 1400,
      scrollHeight: 80,
      offsetWidth: 600,
      offsetHeight: 80,
      getBoundingClientRect: () => ({ width: 600, height: 80, bottom: 80, right: 600, top: 0, left: 0 }),
    }
    expect(measureWithFakePage([poster])).toMatchObject({ naturalWidth: 1400 })
  })
})

describe('滚轮桥', () => {
  test('鼠标下面有顺着这个方向还滚得动的容器（横向滚动的图表、可滚的表格）时让它自己滚，不转发', () => {
    const { messages, registration } = createWheelBridgeHarness({ embedded: true })
    let prevented = false
    const chart = scrollBox({ overflowX: 'auto', scrollWidth: 900, clientWidth: 600 })
    const bar = { nodeType: 1, parentElement: chart, style: {} }
    registration.listener({ cancelable: true, deltaX: 40, deltaY: 0, target: bar, preventDefault: () => (prevented = true) })
    const table = scrollBox({ overflowY: 'scroll', scrollHeight: 800, clientHeight: 300, scrollTop: 120 })
    registration.listener({ cancelable: true, deltaX: 0, deltaY: -30, target: table, preventDefault: () => (prevented = true) })

    expect(prevented).toBe(false)
    expect(messages).toEqual([])
  })

  test('容器在这个方向上已经滚到头、或者根本不能滚时，照旧交给宿主', () => {
    const { messages, registration } = createWheelBridgeHarness({ embedded: true })
    let prevented = 0
    const atEnd = scrollBox({ overflowX: 'auto', scrollWidth: 900, clientWidth: 600, scrollLeft: 300 })
    registration.listener({ cancelable: true, deltaX: 40, deltaY: 0, target: atEnd, preventDefault: () => (prevented += 1) })
    const clipped = scrollBox({ overflowY: 'hidden', scrollHeight: 800, clientHeight: 300 })
    registration.listener({ cancelable: true, deltaX: 0, deltaY: 30, target: clipped, preventDefault: () => (prevented += 1) })
    const sideways = scrollBox({ overflowX: 'auto', scrollWidth: 900, clientWidth: 600 })
    registration.listener({ cancelable: true, deltaX: 0, deltaY: 30, target: sideways, preventDefault: () => (prevented += 1) })

    expect(prevented).toBe(3)
    expect(messages.map((message) => [message.deltaX, message.deltaY])).toEqual([
      [40, 0],
      [0, 30],
      [0, 30],
    ])
  })

  test('嵌在宿主里时，这一次滚轮手势独占地交给宿主', () => {
    const { messages, registration } = createWheelBridgeHarness({ embedded: true })
    let prevented = false

    registration.listener({
      cancelable: true,
      deltaX: 4,
      deltaY: 36,
      preventDefault: () => {
        prevented = true
      },
    })

    expect(prevented).toBe(true)
    expect(registration.options?.capture).toBe(true)
    expect(registration.options?.passive).toBe(false)
    expect(messages).toEqual([
      {
        type: HtmlArtifactBridgeMessageTypes.wheel,
        deltaX: 4,
        deltaY: 36,
      },
    ])
  })

  test('单独下载下来的制品不拦滚轮', () => {
    const { messages, registration } = createWheelBridgeHarness({ embedded: false })
    let prevented = false

    registration.listener({
      cancelable: true,
      deltaX: 0,
      deltaY: 24,
      preventDefault: () => {
        prevented = true
      },
    })

    expect(prevented).toBe(false)
    expect(messages).toEqual([])
  })

  test('iframe 自己还滚得动时，滚轮留在 iframe 里', () => {
    const { messages, registration } = createWheelBridgeHarness({
      embedded: true,
      rootScrollable: true,
    })
    let prevented = false

    registration.listener({
      cancelable: true,
      deltaX: 0,
      deltaY: 24,
      preventDefault: () => {
        prevented = true
      },
    })

    expect(prevented).toBe(false)
    expect(messages).toEqual([])
  })
})
