# @velaros-ai/ui/html-artifacts 模块卡片

> 这一页是本模块的压缩表示：读完就知道它是什么、给了外面什么、骨干链路怎么走、靠什么、状态在哪、失败什么样、哪些承诺不能破。
> 先看沙箱文档类上方的接口（`impl/HtmlArtifactDocuments.ts`，`contract/provides.ts` 登记它），常量表在 `contract/constants.ts`。
> 门禁：`bun run check:module-ownership`；测试：`bun run test`。

## 这是什么

给自己托管沙箱 iframe 的宿主造 HTML 文档：一段模型写的 HTML 或 SVG，变成一份能直接放进 `sandbox="allow-scripts"` iframe 的完整文档，
里面装好桥接脚本（提问、外链、自定义消息、脚本出错、滚轮转发）、尺寸控制器与渲染运行时；再加上宿主侧要的 frame 缩放与外链白名单。

它刻意不认产品：不依赖 React、Electron、Agent Loop，也不绑定任何一家模型 API；零运行时依赖，整条引用链不碰 Node 模块。
VelarOS 的消费方——`@velaros-ai/ui` 的 Widget 预览与 Desktop 的 Widget 存档——都自己托管 iframe，只用这一件能力。

以前是独立包 `@velaros-ai/html-artifacts`，2026-09-18 并进 `@velaros-ai/ui` 成为它的一个单元，入口换成 `@velaros-ai/ui/html-artifacts` 子路径（ADR 0014）。
2026-09-26 流式 HTML 渲染下线，增量协议与浏览器宿主 `mountHtmlArtifact` 一并删掉，只留沙箱文档。
用法与宿主的安全责任见 ui 的 [`docs/html-artifacts.md`](../../docs/html-artifacts.md)。

## 提供什么

**产品面**，登记在 `contract/provides.ts`：能力的 API 定义在类的上方，这里 re-export；对外的值按接口标注类型：

| 值 | 接口 | 做什么 |
| --- | --- | --- |
| `htmlArtifactDocuments` | `HtmlArtifactDocumentsApi` | 沙箱文档：`buildDocument` / `buildShellDocument` / `normalizeSource` / `inferContentKind` / `resolveFrameFit` / `normalizeExternalUrl` |
| `HtmlArtifactDefaults` | 契约常量 | 尺寸上限、宿主缩放边界、外壳根元素 id |
| `HtmlArtifactBridgeMessageTypes` | 契约常量 | 滚轮消息名与六个缺省桥接消息名 |
| `HtmlArtifactExternalUrlProtocols` | 契约常量 | 外链缺省放行的协议 |

没有注入面：能力全是纯计算，不碰宿主的浏览器边界。

**数据面**是 `types/html-artifacts.ts`（可移植）：`HtmlArtifactContentKind`、`HtmlArtifactBridgeMessages`、`HtmlArtifactDocumentOptions`、
`HtmlArtifactShellDocumentOptions`、`HtmlArtifactFrameFit`、`HtmlArtifactFrameFitInput`、`NormalizeHtmlArtifactExternalUrlOptions`。

两个入口对应 `@velaros-ai/ui` 包清单 `exports` 里的 `./html-artifacts` 子路径，源文件是单元目录上的入口文件，只有转发语句：

| 入口 | 给谁用 | 里面有什么 |
| --- | --- | --- |
| `./html-artifacts` | 任何浏览器环境，含渲染进程与扩展 | 沙箱文档能力、常量表与全部公开数据 |
| `./html-artifacts/contracts` | 同上，只要数据不要能力时 | 常量表与可移植数据 |

## 骨干链路

| 能力 | 链路 |
| --- | --- |
| 造一份静态文档 | `htmlArtifactDocuments.buildDocument(source, options)` → `utils/shell-document.ts` 剥外层包装、拼头部桥接脚本、尾部就绪脚本与测量脚本（尺寸控制器源码来自 `utils/size-controller.ts`，缺省值从常量表插值） |
| 造一份外壳文档 | `htmlArtifactDocuments.buildShellDocument(options)` → 同一份桥接脚本与尺寸控制器，外加渲染运行时：宿主经 `render` 消息把整份 HTML 送进来，运行时对比着落到根元素上、激活脚本、发就绪事件，量出尺寸报回去 |
| 算 frame 尺寸 | `htmlArtifactDocuments.resolveFrameFit(input)` → `utils/frame-fit.ts` 按宽度比例给缩放比，超过 `hostMaxScaleDownWidthRatio` 倍就停止缩放 |
| 过一个外链 | `htmlArtifactDocuments.normalizeExternalUrl(value, options)` → `utils/external-url.ts` 按协议白名单判，不合法给 null |

## 依赖什么

- 零运行时依赖：不依赖 `@velaros-ai/core`，守卫在 `utils/runtime-guards.ts` 留一份最小实现。
- 不碰 Node 内置模块、不读环境变量、不读写磁盘、不发请求。
- 生成的文档只用浏览器里本来就有的东西：`postMessage`、`URL`、`ResizeObserver` / `MutationObserver`（没有时退化成定时上报）。

## 状态归谁

- `htmlArtifactDocuments` 完全无状态，同样的入参给同样的出参。
- iframe、消息监听与尺寸都归托管 iframe 的宿主；文档里的注入脚本只在自己那个 iframe 里记测量状态。

## 生命周期

- `htmlArtifactDocuments` 随进程存在，没有要释放的东西。
- 一份外壳文档：宿主把它写进 iframe → 加载完发 `render` 消息 → 运行时渲染、报尺寸 → 内容变了再发一次 `render`；iframe 的创建与销毁归宿主。

## 失败语义

- 这件能力本身不抛错：非法外链给 null，测不出尺寸时给一份未锁定的兜底适配。
- 沙箱里的脚本出错、外部脚本被拦，经桥接消息 `error` 报给宿主；理不理由宿主自己定。
- 文字是中文，只给人看；外面按返回值与消息名判断，不按文字。

## 不变量

共 3 条，登记在 `spec/invariants.md`，验收用例在 `spec/acceptance.test.ts`。编号只增不重排，退役的编号不复用。
按检验方式：测试 2 条、门禁 1 条。未验证 0 条。

## 非目标

- 不管模型怎么被提示出这段 HTML：提示词、聊天状态、Agent 调度都在别处。
- 不管 iframe 的托管：建 iframe、收发消息、滚轮代滚、卸载清理都是宿主的事。
- 不管产品 UI：折叠、工具栏、下载、复制代码这些由消费方自己做，本包只给机制。
- 不管权限与审批：打开链接、继续提问是宿主显式处理的消息，不是沙箱自己的权力。

## 结构

```text
src/html-artifacts/
  contract/     对外合同：provides.ts 登记沙箱文档的 API（定义在类上方，这里 re-export），constants.ts 是尺寸缺省、桥接消息名与外链白名单
  types/        只放类型：html-artifacts.ts 是可移植数据，internals.ts 是不出包的工作类型
  impl/         一类一文件：HtmlArtifactDocuments
  utils/        shell-document.ts 文档构造、size-controller.ts 注入脚本源码、frame-fit.ts 宿主缩放、external-url.ts 外链白名单、runtime-guards.ts 零依赖守卫、tuning.ts 可调参数
  index.ts      `./html-artifacts` 入口，只转发
  contracts.ts  `./html-artifacts/contracts` 入口，只转发
  spec/         不变量登记与验收测试
  test/         实现细节测试
```

**分层。** 实现只有一层（登记在 `scripts/ownership/governed-modules.mjs`）：沙箱文档的出口 `HtmlArtifactDocuments.ts`。
utils 在它之下，只引 utils、types 与合同。

**类与接口。** 类实现的接口定义在类文件里、紧挨在类的上方并导出，在 `contract/provides.ts` 登记；类的公开成员只能是接口里的成员。

| 实现文件 | 接口 | 做什么 |
| --- | --- | --- |
| `HtmlArtifactDocuments.ts` | `HtmlArtifactDocumentsApi`（同文件，provides 登记） | 沙箱文档与尺寸、外链判定的唯一出口，实例 `htmlArtifactDocuments` |
