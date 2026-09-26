# HTML 工件（`@velaros-ai/ui/html-artifacts`）

**给自己托管沙箱 iframe 的宿主造 HTML 文档。**

零运行时依赖的浏览器库：把一段模型写的 HTML 或 SVG 变成一份能直接放进沙箱 iframe 的完整文档——桥接脚本、受限高度协商、
渲染运行时都装好；外加宿主侧的 frame 缩放与外链校验。不依赖 React、Electron、Agent Loop，也不绑定任何一家模型 API。
它原来是独立包 `@velaros-ai/html-artifacts`，2026-09-18 并进 `@velaros-ai/ui` 成为一个单元（ADR 0014）；
2026-09-26 流式 HTML 渲染下线，增量协议 `htmlArtifactProtocol` 与浏览器宿主 `mountHtmlArtifact()` 一并删掉。
模块卡片见 [`src/html-artifacts/MODULE.md`](../src/html-artifacts/MODULE.md)，对外承诺见 [`src/html-artifacts/spec/invariants.md`](../src/html-artifacts/spec/invariants.md)。

| 入口 | 内容 |
| --- | --- |
| `@velaros-ai/ui/html-artifacts` | 沙箱文档 `htmlArtifactDocuments`，外加约定常量与数据类型 |
| `@velaros-ai/ui/html-artifacts/contracts` | 它的子集，只有约定常量与可移植数据类型；只要数据不要能力时用它 |

## 快速开始

```ts
import { HtmlArtifactBridgeMessageTypes, htmlArtifactDocuments } from '@velaros-ai/ui/html-artifacts'

const source = '<main><h1>Hello</h1></main>'
const iframe = document.createElement('iframe')
iframe.setAttribute('sandbox', 'allow-scripts')
iframe.srcdoc = htmlArtifactDocuments.buildShellDocument({ maxReportedHeight: 720 })
iframe.addEventListener('load', () => {
  iframe.contentWindow?.postMessage(
    { type: HtmlArtifactBridgeMessageTypes.defaults.render, html: source },
    '*'
  )
})
document.querySelector('#preview')?.append(iframe)
```

`buildShellDocument` 造的是外壳：内容随后经 `render` 消息整份送进去，内容变了再发一次，运行时对比着更新根元素。
内容已经齐了、只想要一份独立文档（下载、存档）时用 `buildDocument(source)`。

## 三件必须理解的机制

### 1. 高度：绝对值，单向

iframe 运行时上报的是**去重后的绝对内容高度**（`resize` 消息），宿主直接应用——不加 padding，也不把 viewport 增长反馈回测量过程（那正是无限撑高的来源）。
`maxReportedHeight` 是 iframe 内侧的硬上限：超高内容或 `100vh` 这类 viewport 耦合页面会留在沙箱里滚动，不会把外层页面顶穿。
宿主侧拿 `resolveFrameFit` 按宿主宽度算缩放比，过宽的内容缩进来，极端宽度停止缩放。

### 2. 链接：默认只放行 http / https

沙箱里调用 `openLink(url)` 只会发一条 `openLink` 消息；宿主先过 `normalizeExternalUrl`，无效或主动执行型 URL（`javascript:` 一类）拿到的是 null。

### 3. 桥接消息只是请求

`sendPrompt()`、`openLink()`、`artifactBridge.send()`、脚本出错和滚轮转发都只是发给宿主的消息——**没有隐式能力**，
宿主决定理不理。消息名缺省见 `HtmlArtifactBridgeMessageTypes`，造文档时可以经 `bridgeMessages` 换掉。

`htmlArtifactDocuments` 的全部方法：`buildDocument` / `buildShellDocument` / `normalizeSource` / `inferContentKind` / `resolveFrameFit` / `normalizeExternalUrl`。

## 宿主的安全责任

交给它的 HTML 一律当**不可信输入**。改沙箱、脚本、URL 或消息桥之前先读这一节：

- 用沙箱 iframe。够用的最小策略通常是 `sandbox="allow-scripts"`，不给 `allow-same-origin`。
- 接受任何桥消息之前，先核对 `MessageEvent.source` 是不是这个 iframe 的 `contentWindow`。
- 在宿主里把消息载荷再校验一遍：消息名只是路由提示，不是授权。
- 文件、进程、凭据、剪贴板、支付与网络这些权力一律留在 iframe 外面。
- 外部跳转经 `htmlArtifactDocuments.normalizeExternalUrl`，或者同样严格的宿主策略。
- 按宿主自己的威胁模型配内容安全策略（CSP）。

生成的 iframe 外壳会上报运行时错误，但不授予任何宿主能力；它的 `postMessage` 桥只是一条请求通道。
发现漏洞请先别公开利用细节，经 GitHub 仓库的安全报告渠道联系维护者。

## 边界：它不负责什么

只维护**可复用的沙箱文档机制**。不含 iframe 托管、流式解析、模型提示词、聊天状态、Agent 调度、Electron IPC、产品 UI、权限、记忆或 Kernel 内部实现。
