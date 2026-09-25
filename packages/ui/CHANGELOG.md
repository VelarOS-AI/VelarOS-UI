# Changelog

`@velaros-ai/ui` 的变更记录。遵循 [Keep a Changelog](https://keepachangelog.com/) 与
[Semantic Versioning](https://semver.org/)。门面包背 semver 承诺（§12「门面收口」）；内部原子演化
不进本记录。记录起点为 `@velaros-ai/ui` 公开门面与组件库成型。

## [Unreleased]

### Removed

- 发布包不再随附 `LICENSE`、`NOTICE`、`THIRD_PARTY_NOTICES.md` 与 Tailwind CSS 第三方许可文本：许可证只有
  仓库根目录一份 `LICENSE`。
- 卡片动作 `enable_prompt_features`：`UserActionCardAction` 去掉这一支，`UserActionCardResult.actionKind` /
  `ConversationCardResolution.actionKind` 随之收窄。插件体系已下线，没有可开启的能力。
- 输入框「+」菜单的「插件」子菜单、活动芯片里的插件芯片与写死的插件能力目录（Office 及其细分、Computer Use、
  HTML 实时预览、Widget）：`ChatInputFeaturesControl` 去掉 `promptFeatures`、`lockedPromptFeatures`、
  `onPromptFeaturesChange`、`unavailablePromptFeatures`、`resourceAvailabilityResolved` 与
  `workbenchEditorControlAvailable`（「AI 操控编辑器」开关一直隐藏，状态也存在 `promptFeatures` 里，一并删掉）；
  `ComposerAddMenuFeaturesProps` 去掉 `showPluginsSubmenu`、`pluginOptions`、`selectedPromptFeatures`、
  `updatePromptFeatureGroup` 与三项编辑器开关字段，`ChatInputComposerAddMenuBridgeInput.features` 去掉
  `canTogglePlugins`，`ComposerSubmenuId` 去掉 `'plugins'`；删除 `useComposerPromptFeatures`、
  `useChatInputPromptFeatureActivationBridge` 与类型 `ChatInputPromptFeatureOption`、
  `ChatInputPromptFeatureGroupOption`、`ChatInputPromptFeatureLabelKey`、`ChatInputIconComponent`；
  文案目录删掉 `chat.composerPlugin*`、`chat.composerPlugins`、`chat.composerHtmlArtifacts`、
  `chat.composerWorkbenchEditorControl(Hint)` 共 15 条。
- 按工具名归并的工具行：`MergedToolCallRow`、`ToolCallGroup`、`mergeToolCallGroups`、
  `pickRepresentativeToolBlock`、`TOOL_GROUP_COLLAPSE_MIN`、`ToolRenderGroupingOptions`，以及只为预载工具卡分包的
  `preloadToolActivityRenderer`。

### Added

- `ScriptExecutionBlock` / `ScriptExecutionCall`（`@velaros-ai/ui/conversation/contracts`）并入 `ContentBlock`：
  一次 ScriptAct 的 execute 声明，带宿主取好的一句话标题、有界源码、用到的模块与每次能力调用。
- `ScriptExecutionCard`：一行里是状态、标题（为空时按首个调用的「模块 · 操作」兜底，再没有就是「执行脚本」）与
  模块标签（去掉 `velaros:` 这类前缀，多于三个收成「+N」）；悬停或键盘聚焦标题行弹出源码气泡（HoverCard，能追进去
  滚动与选中复制，Escape 关闭）；点开按顺序列出每次调用的状态、外部效果、参数与返回（长的先折起来），失败时标题下
  一行露出原因。`formatScriptModuleLabel` / `resolveScriptExecutionTitle` 供宿主复用同一套标签与标题兜底。
- `ToolCallStepCard`：旧 `tool-call` 块的通用步骤卡，与脚本卡同一副外框（工具名、状态、耗时，点开看参数、进度、
  结果与错误）。
- `MessageBubble.runInProgress`：这条消息所属的执行还没停时收尾件先不出现；`ChatTranscript` 自己算出来传入。
- `getToolActivityCountLabel`：活动折叠的「调用了 N 次工具」标题。
- `HoverCard`（`@velaros-ai/ui/primitives/overlays/HoverCard`）：可悬停详情气泡。停留片刻弹出，指针移进气泡时保持打开，
  文字可选且选中后不会在复制前消失；键盘聚焦触发元素同样弹出，从不抢焦点；Escape / 外部点击关闭，随触发元素滚动；
  `widthStrategy="anchor"` 时与触发元素等宽并随其宽度变化同步。气泡不描边，靠表面色与四周投影区分。
- 工具行悬停详情：`CompactToolRow.hoverContent` 与 `ToolResultSummaryItem.hoverContent`（提供后行可聚焦，行与计数上的
  原生 title 不再挂出，气泡与行等宽）；`getToolOperations` 推导一次调用实际执行的操作与对象，`ToolCallHoverDetails`
  渲染详情。内置工具行与归并行（×N）都已接上，归并行按调用顺序逐次列出。未接详情的工具行，溢出全文气泡同样与行等宽、不描边。
- `describeToolCallHover` / `doesToolCallHoverAddToRow` / `resolveToolCallHoverContent`：先把悬停详情推导成纯数据，
  再判断它比行多不多出信息，多不出就不给行挂气泡。
- `getToolMergedDetailItems`：归并行（×N）逐次调用在行内点名的对象，与该工具单独成行时的摘要一致。
- `PopoverContent` 把触发元素中心在浮层内的坐标写成 `--velar-popover-anchor-center-x/y`，供浮层画指向触发元素的箭头。
- `ChatMessage.systemNoticeKind`（`rewind` | `goal-continuation`）：系统通知行按类别选图标，目标自动续跑的留痕显示靶心。
- `scrollBehavior` 新增夹底守卫与自动收起扣留的纯策略（`resolveScrollClampGuard`、
  `resolveAutoCollapseHold`、`ScrollClampGuardCssVariable`）。
- `ChatInputFeaturesControl.voiceInput`：传 false 时输入框不显示麦克风按钮，供没有可用语音转写的宿主使用；
  默认 true，现有用法不变。

### Changed

- 会话里的 `tool-call` 块不再按工具分类渲染（分类图标、命令 / 文件改动 / 搜索结果等专属卡、同名归并的「×N」行、
  悬停里按工具登记的操作摘要），一律是 `ToolCallStepCard`，按发生顺序各占一行；连续的调用仍收在活动折叠里，
  折叠标题只数次数，不再拼「已编辑 / 已探索 / 运行命令」。需要专属卡的宿主单独嵌 `ToolCallBlock` 并传自己的
  `ToolRendererRegistry`。
- `buildToolRenderSegments(blocks)` 一块一段，去掉 `collapseMin` 与选项参数；`ToolRenderSegment` 只剩
  `{ kind: 'block', block, key }` 一种形状，脚本执行块的 key 是 `script:${id}`。
- 执行步骤卡不再画状态图标（对号、感叹号、转圈），状态看整张卡的底色，与原来的工具行同一套：进行中与已取消
  是很淡的灰，成功淡绿，失败淡红；读屏文字照旧。标题行最左是步骤的图标：执行是命令图标，观察是搜索图标，旧工具
  调用是工具自己的图标；行尾不再放代码提示图标，也没有状态字。`ExecutionStepFrame` 新增必填 `icon`，删掉
  `ExecutionStepStatusIcon`。
- `ScriptExecutionBlock` 新增必填 `kind: 'execute' | 'observe'`：observe 是登记持续观察的声明，与执行只靠图标区分，
  没有标题时是「持续观察」。新增必填 `durationMs`（这一步执行用了多久，还没有结果时为 null），标题行右边显示耗时；
  去掉 `modules`，卡上不再列模块标签。
- 脚本卡点开后只放执行的代码与每次调用的结果（都按语法着色，与聊天代码块共用同一个 Shiki 高亮器与主题），不再
  列每次调用的「模块 · 操作 · 状态 · 效果」标题行和参数；展开后悬停标题行不再弹源码气泡。`ExecutionStepPayload`
  的 `label` 改为可选，新增 `language`。文案目录删掉 `scriptExecution.call*`、`noCalls`、`scriptError`、
  `moreModules` 共 14 条，新增 `scriptExecution.observeTitle`。

### Deprecated

- `MessageBubbleProps.planUpdateIndexByToolCallId` / `ChatTranscriptProps.planUpdateIndexByToolCallId`：计划专属卡
  不再出现在会话里，计划序号不参与渲染，传了也被忽略。

### Fixed

- 运行还没结束时，执行中途的助手消息不再提前露出复制与时间、文件改动汇总和动作行：这些消息既不流式也没有运行标记，
  原判据把它们当作已结束。现在同一轮里上一次执行停下之后、到正在流式或等待作答的那条为止都算没停。
- 计划卡（顶部固定坞与对话里）的标题显示本地化的「计划 / Plan」，不再显示 plan:update 工具名。
- 会话重开后记下的滚动位置比现有内容还深时（例如一次展开的长运行留下的位置，重开后历史已折叠），读者往上翻
  会被每一段流式内容拽回底部，发新消息也清不掉：待恢复的位置现在在读者滚动、上滑或发出新消息时作废。
- 长时间运行中上滑阅读时，运行结束或工具调用的自动收起不再把视口拽到底部或别处：完成态「已处理」、
  思考块和动作卡的自动折叠只在读者跟随底部时发生，未跟随时保持展开。
- 读者未跟随时视口里的内容变矮，会话滚动在绘制前用末尾占位撑住原位置，不再被浏览器夹到新的底部。
- 同一轮里先建目标再更新计划时，目标卡不再缺席顶部固定坞：本轮 goal:create / goal:update 一落定就重读目标，
  不再等整轮结束。
- 批量 `project:read` 的工具行显示首个文件并计数其余；`project:search` / `project:query-code` 行内先说查询词或符号，
  搜索范围放进悬停详情（`getToolSearchScopeItems`）；`project:write` 按文件改动渲染并计入「已编辑」。
- 工具行的悬停气泡找回指向行的小箭头（改用 HoverCard 后丢了）：箭头填气泡自己的底色、不描边，对准行的中间，
  气泡翻到行下方时箭头跟着翻；气泡外层不再裁剪，超高时由内容层滚动。没接详情、只在 detail 被截断时才弹的全文气泡
  也改用同一个 HoverCard（与行等宽、不描边、带箭头、可以追进去选字）。
- 悬停气泡只会重复行上已有的内容（同样的工具名和耗时，没有多出的操作、对象、命令、参数或结果）时不再弹出。
- 计划、目标、方案、指令、子 Agent、后台任务、上下文召回、提问与动作卡、浏览器、工作台、Office、桌面控制、系统进程、
  定时任务、协作与媒体生成等工具行在工具名后写出作用对象（如 `plan:update 1/3 · 实现修复`、
  `goal:update complete · 修复保存失败`、`browser:act target.click · button 登录`），悬停详情给出比行更完整的内容
  （计划与目标的每一步、目标全文、子 Agent 的提示词、页面地址等）；外部引擎映射来的 `file_path` / `pattern` 参数
  也能读出对象。归并的计划更新行逐次显示「进度 · 当前步骤」。

## [0.2.35] — 2026-09-08

### Added

- 会话根入口新增统一的滚动跟随状态机、楼层导航显隐 store/hook 与受控头部开关，供 Desktop、
  Workbench 通过宿主组合复用。

### Fixed

- 流式执行期间冻结消息树刷新代际，用户上滑不再被高频 revision 重挂滚动容器并拉回底部。
- 浮动楼层导航接管其命中区域内的滚轮/触控板位移，并在减少动态效果偏好下关闭过渡。
- 消息气泡、附件、工具卡、长路径与详情 tooltip 受会话宽度约束；窄侧栏的消息元信息不再覆盖。
- 短代码块和短表格直接完整显示，仅在内容真实溢出时提供展开控制。

## [0.2.32] — 2026-09-07

### Fixed

- Git 分支控件统一使用通用按钮、搜索框和浮层外观，普通加载与懒加载保持一致，修复额外边框、背景和阴影。
- Popover 显式排除桌面窗口拖拽区域；分支搜索在浮层定位可见后获得焦点。
- 关闭浮层时恢复实际触发按钮的焦点，点击外部输入框时保留外部焦点。

### Added

- `PopoverContent` 和 `AnchoredPopover` 提供 `onOpenAutoFocus`，由调用方在定位完成后选择聚焦目标。

## [0.2.31] — 2026-09-06

### Changed

- 包清单改用 GitHub 可识别的规范 HTTPS 源地址，使公开包页面能关联到唯一的 Platform 仓库。

## [0.2.30] — 2026-09-06

### Changed

- 发布包现随附 Apache-2.0 `NOTICE` 与 Tailwind CSS 第三方许可文本。

## [0.2.29] — 2026-09-02

### Fixed

- 聊天输入框的模型摘要只显示模型名，厂商仍保留在展开菜单中，给计划、目标等动态状态留出工具栏空间。

## [0.2.28] — 2026-08-30

### Fixed

- 输入框正文为空时按退格键会移除最后一张待发送图片，并保持共享会话输入行为一致。

## [0.2.17] — 2026-08-29

### Added

- `Select` 新增长列表搜索能力，搜索区固定在列表顶部，并提供无匹配结果提示。

### Fixed

- 下拉选项视口统一绘制可见滚动条，在 macOS 覆盖式滚动条设置下仍能明确展示可滚动状态。

## [0.2.16] — 2026-08-29

### Fixed

- Git 分支菜单的搜索区域直接复用共享 `SearchField`，图标、输入层、边框与聚焦态由同一个控件持有，避免基础输入框在外壳内再次绘制边框。

## [0.2.15] — 2026-08-28

### Added

- 会话消息新增可选归属字段 `peerOrigin` 与判据 `isPeerOriginMessage`：标记一条 `role: 'user'`
  的消息由**同组的另一条会话**写入，而不是用户本人。用户气泡据此显示同伴署名（`UsersThree`
  图标 + `chat.peerMessageFrom` 文案），与运行中引导标签互斥且优先——两者万一同时出现，
  「这不是用户说的」是更要紧的那条信息。
- 归属刻意不做成新的 `ChatMessageConversationKind` 成员：`conversationKind` 是结构轴（起不起
  一轮、能否回退、是不是分段边界），归属是另一根轴。同伴消息确实起一轮真实执行，必须保持
  `turn-input`——换成新 kind 会静默丢掉回退按钮、分页分段起点、「最近一次用户请求」映射与
  活动分组的轮次边界，而且一处编译错误都不会有。

## [0.2.14] — 2026-08-26

### Added

- 新增共享 `SearchField` 原语，统一搜索输入、清除和聚焦语义。
- 新增 `WorkspaceGitCommitControl`，在组件内部统一承载成熟分支菜单、文件夹分组与新建分支弹窗，并通过宿主端口执行 Git 动作。

## [0.2.13] — 2026-08-25

### Added

- 会话 Markdown 支持渲染 Mermaid 声明式图表，并可在右上角双向切换预览与源码。

### Changed

- HTML 与声明式图表代码块共用通用的预览/源码状态框架；流式生成期间稳定回退到源码，完整后再进入可视预览。

## [0.2.11] — 2026-08-25

### Fixed

- 折叠组件的自动收起由完成态实时信号统一驱动。

## [0.2.10] — 2026-08-25

### Fixed

- 会话正文只把绝对文件路径渲染为可打开的文件链接；文件名、`src/`、`test/` 等相对路径保持普通文本，避免被浏览器当作页面 URL。
- 用户向上滚动后，转录窗口与宿主滚动钉底状态同步暂停；模型首段输出和后续流式增长不再重建末尾窗口并夺回视口。
- 引导开始但新 assistant 消息尚未到达时，上一条已完成消息保持原有折叠状态。
- “已处理”的完成信号在容器已挂载后到达时仍会执行自动收起。

## [0.2.9] — 2026-08-25

### Changed

- 会话卡片契约统一为 `conversationCards` / `conversationCardContent`：宿主卡渲染到会话正文，`SessionStickyDock` 只承载由会话壳派生的 Plan / Goal 状态卡。
- Plan / Goal 在正文中保留通用工具调用行，完整状态卡集中到 `SessionStickyDock`。

## [0.2.8] — 2026-08-25

### Fixed

- 一次带引导的完整交流只生成一个“已处理”：运行中保持原 assistant 宿主，正常完成后由最终 assistant 统一承载此前内部活动，最终总结留在折叠外。
- 归组后的子消息不再各自生成嵌套折叠组件；引导内容保留在唯一的“已处理”内部。

## [0.2.7] — 2026-08-25

### Fixed

- 引导固定归属于插入前已挂载的 assistant，后续片段不会更换宿主或重置上方折叠状态；完成标记从整轮最后状态统一投影。
- 完成态内部的连续思考与工具折叠项跨消息横排，正文和引导仍保持独立行。
- 回顶和向上分节导航会先暂停自动跟随；内容重排和下一帧提交也不会把已离开底部的视口重新拉回。

## [0.2.6] — 2026-08-25

### Fixed

- 引导作为当前运行的内部状态插入时不改变前序活动块的折叠状态；已结束的旧会话仍保留每个活动块的折叠入口。
- 连续折叠的思考、工具与命令摘要合并到同一行展示。

## [0.2.5] — 2026-08-24

### Added

- `@velaros-ai/ui/conversation/composer` 新增 `ChatSurfaceComposer`：由共享的
  `default` / `side` 表面形态统一派生输入框密度，Desktop 与 Workbench 只注入
  `ChatComposerControl`，不再分别维护紧凑模式条件。
- 新增封闭契约的 `TaskWorkspace`、任务列表、详情与回放布局，并登记到组件图鉴。

### Changed

- `run-guidance` 只作为当前运行的内部状态：运行中不创建新会话分段，完成后与同一运行的
  assistant 活动统一折叠到一个“已处理”入口，展开后保留引导内容。

## [0.2.4] — Workbench composer parity

### Added

- `FileTypeIcon` recognizes `.vel` files and renders the official borderless
  VelarScript V/S mark with theme-aware contrast.
- Workbench 当前文件 chip 新增可选移除回调；未传回调时外观与交互保持不变，
  传入后复用 Desktop 同一套“悬浮图标变 ×”的 chip 行为。
- `@velaros-ai/ui/conversation/render-slots` 增两格**替换槽**：`messageMarkdown` / `messageCodeBlock`
  （+ props 契约 `ConversationMarkdownSlotProps` / `ConversationCodeBlockSlotProps`）。两格为**可选**
  属性，缺席 = 官方内置件原行为；替换件弃权（返回 `null`）或渲染抛错一律回落官方件。

## [0.2.2] — 第三方包边界与接口文档

### Added

- 补齐正式 npm 元数据、中文 API 文档与发布 tarball 契约门禁。
- 导出流式会话调度端口，并提供应用隔离的 `ToolRendererRegistry`。

### Removed

- 删除只做原样返回的工具注册辅助函数，注册声明改用显式类型。

## [0.2.0] — 运行时零依赖与封闭导出

### Changed

- `@velaros-ai/ui/conversation` 的消息、工具、运行态和宿主动作类型改为包内纯展示 DTO/ports；
  Result、计时器、JSON 读取、工具视觉目录与 composer feature 目录全部由 UI 仓自持。
- `@velaros-ai/ui` 的所有受支持组件深路径改为显式 exports，继续保留现有组件根门面与视觉行为。

### Removed

- 删除 `@velaros-ai/ui/conversation` 对 `@velaros-ai/core` 的依赖与全部源码 import。
- `@velaros-ai/ui` 不再发布 `src`，并移除开放式 `./*` export。

### Guarded

- 独立性门扩展到两包：基础 UI 禁止全部外部 VelarOS 包，Conversation UI 只允许 UI 与 HTML
  沙箱库；同时拒绝本地路径依赖、UI wildcard exports 和 source 发布。

## [0.1.3] — 独立组件库边界

### Changed

- `@velaros-ai/ui` 将基础类型判断、可选值辅助、界面计时器与空间图标语义收回包内，不再依赖
  `@velaros-ai/core`。
- 完整组件目录从公开组件 Props 推导示例类型，并使用目录本地 fixture 工具，不再直接引用 Kernel。

### Guarded

- 新增组件库独立性门禁，禁止完整目录、仓库根与 `@velaros-ai/ui` 引入 Kernel、Desktop、
  Workbench 或 HTML Artifacts 运行时依赖。

### Added

- 双色种子色彩体系（§12.9）：新增两个可配置种子令牌 `--velar-primary` / `--velar-accent`（+ 配套
  `-rgb`），品牌相关语义令牌改由双种子派生；官方预置组合 `seed-presets.css`（`velar-indigo` 默认 /
  `graphite-blue` / `forest-amber` / `plum-rose` / `slate-teal`），经 `data-velar-preset` 激活。
  用户配置接口形状见 `docs/ui-color-seeds.md`。默认预置视觉与既有单色现状**逐值等价**。
- 每个公开组件补规范头注释（职责一句话 / variant 封闭枚举 / 样式引用）。
- `README.md` 重写为组件索引（primitives / product 分区，每组件一行）+ 双色种子令牌表 + §12.9 存量
  收敛 Backlog 节。
- `publishConfig.access = public`（门面包对外发布）。
- 发布纪律：起卷 `CHANGELOG.md`。

### Changed

- `--primary` / `--primary-rgb` 由主题种子派生（历史令牌名保留为兼容别名）；`--memory-accent-*`
  由副色种子派生。既有主题（浅色）视觉逐值等价。

### Removed

- 删除死代码 `styles/components/index.monolith.css`（未被任何入口 @import / 未导出，被拆分后的
  `index.css` + `primitives/*.css` 取代）。

### Guarded

- arch-guard 新增 `velaros/ui-component-form-closure`（§12.9）：`packages/ui` 组件禁 className/style
  透传与 ComponentProps 全展开；存量入 baseline 冻结、新增即红。
- arch-guard 新增 `velaros/ui-color-literal-closure`（§12.9 双色种子）：组件层禁裸 hex/rgb/hsl 色值，
  令牌层豁免；存量入 baseline 冻结、新增即红。

## [0.1.2] — 可交互组件图鉴

### Added

- 独立预览页升级为完整组件目录，按动作、表单、展示与反馈、导航与布局、浮层、产品组件六类
  展示 30 个可交互现场示例。

### Fixed

- 提升 ghost 按钮文字对比度，并补齐键盘焦点与按下反馈。
- 修复 `useDisclosurePresence` 在 React StrictMode effect 重放后复用已释放 `TimerScope`、
  导致折叠组件预览崩溃的问题。

## [0.1.1] — 独立消费元数据

### Added

- npm 包随 `dist` 一并携带 `src`，作为组件图鉴构建期的类型、注释与 variant 默认值元数据。
  Desktop 只从已安装的版本化包读取，不再探测相邻 `VelarOS-UI` 工作区。

## [0.1.0] — 组件库重生

### Added

- 跨产品 **primitives**（buttons / display / forms / layout / overlays）与 VelarOS **product** 壳层
  组件（AppShell / ActionCard / CardKit / BusinessSurface / Settings / TopBarControlFrame 等）。
- 全局 `.velar-*` CSS 组件类层（纯 CSS + 设计令牌，无 Tailwind `@apply`）。
- 设计令牌入口 `styles/tokens/design-tokens.css`（浅色主题 + 暗色占位）。
- 组件库图鉴 registry 与「公开组件必须有 entry 覆盖」生成器硬门。
