// 模块结构登记：哪些模块已进入治理，工具、契约、类型、实现、工具函数各放在哪。
// 方案正文见 docs/architecture/module-ownership.md；本文件是门禁的单一来源。
// 本仓只有一个包（仓根就是 @velaros-ai/ui），下面的路径字段都相对仓根写。
//
// 字段：
//   unit            能力单元的目录名（不填就是普通模块）：几件能力按目录放在同一个包里，共用一份清单与许可；
//                   源码根默认是包根下的 <unit>/，其余路径字段仍相对包根写；name 写成「包名/单元」
//   root            单元源码根不在包根下时登记（相对包根，例如 src/html-artifacts）
//   packageEntry    能力单元承载包的根入口；仍按该单元源码目录执行完整治理
//   name            包名
//   toolsFile       工具文件（相对包根，没有工具的包不填）：全部工具定义都在这一个文件里，外加它们的分组与挂载。人最先看的地方，改了要在差量报告里点名；
//                   execute 只放简单的一两步，语句多了就交给 impl 里的类
//   contract        对外合同目录：只有三个文件——provides.ts 产品面（交出去的整件能力；类实现的 API 定义在类上方，这里 re-export 登记，
//                   没有类的公开接口直接声明在这里）、requires.ts 注入面（宿主要塞进来的东西）、constants.ts 约定的常量表（工具身份、错误码、
//                   环境变量表、公开上限）。改这三个文件等于改对外契约
//   types           类型目录：扁平，只放类型、一个值都没有，按域分文件；哪些出包由合同的签名闭包决定。
//                   可移植文件 = types/<portable> + contract/constants.ts：不 import（可移植类型文件只许从常量表 import type）、不用 Node 类型、不带函数成员
//   portable        可移植数据类型文件（相对 types）；`./contracts` 入口 = 它 + contract/constants.ts。没有自己的可移植数据的包（只做装配的空间）不填，`./contracts` 只转发常量表
//   impl            实现目录：扁平，不分子目录。一个类一个文件，文件名就是类名（工具文件除外，它不放类）；
//                   每个类实现一个接口（公开的定义在类上方并在 provides.ts 登记，注入面的在 requires.ts），公开成员不超出接口，私有方法必须用到实例状态
//   utils           纯工具函数目录：扁平，按类别分文件；只放函数和常量，每个函数上方一句中文说明，只引 utils、types 与合同
//   tuning          可调参数文件（相对 utils，没有可调参数的包不填）：超时、缓冲、保留条数、缺省条数、阈值集中在这一个冻结表里，每项一句说明、每项有人用；
//                   数字缺省值不许散在 impl 与 utils。对外承诺的上限不在这里，在 contract/constants.ts
//                   （对外入口不登记：入口文件就是 src 根上的那几个 .ts，与 package.json 的 exports 一一对应，
//                   多入口只为运行环境隔离而留；它们编译成 dist/<名>.js 与 dist/<名>.d.ts）
//   browserSafeEntries  会被渲染进程加载的入口（src 根上的入口文件名，嵌套子路径写成 protocol/message.ts）：整条引用链不许出现 Node 内置模块
//   environmentTable    常量表里登记环境变量的表名（不读环境变量的包不填；不填时代码里出现环境变量名就拦）
//   environmentPrefixes 除 VELAROS_ 外还要扫的环境变量前缀（读别人定义、改不了的名字时才填）：只扩大扫描面，不是豁免，
//                       登记的名字照样要有人用、代码里的名字照样要先登记；新起的变量名一律 VELAROS_
//   hostPort            注入面里的端口接口名；端口只放真会被调的方法，门禁从模型面入口（surfaceFile，没有就是 toolsFile）出发沿 import 核对
//   hostPortField       调端口时的字段名（ctx.<字段>.方法 或 this.<字段>.方法）；登记了 hostPort 就必须写
//   surfaceFile         模型面入口（相对包根）：代码面能力的操作类，或空间的装配表；端口可达性从这里出发。一个单元出几件能力、各有操作类时写成数组
//   assets              单元里随包发布的非 TypeScript 资产目录（只有能力单元填，写单元目录下的目录名）：比如 helper 脚本。门禁不扫里面的文件，
//                       但它必须真在、并且写进包清单的 files（`<单元>/<目录>`），不然装出来的包里没有它
//   status              'migrating' 表示正在按标准改造：问题照查照报条数，不计入失败（改造完删掉这一项）
//   lazyImports         允许动态 import() 的目标（不填的包一条都不许有）：每项 { specifier, file, reason }——
//                       specifier 是 import() 里的字符串原文，file 是唯一允许加载它的源文件（相对包根），
//                       reason 一句话写清为什么必须懒加载。登记过的目标必须真有人加载，没人用的要删
//   layers          实现文件的分层（文件名），从上到下；上层可以引下层与同层，下层不许引上层；每个实现文件都要登记在某一层
//   toolDefiner     定义工具的函数名；它只许在工具文件里被调用，保证工具定义一个不漏都在那里
//   card            模块卡片（相对包根）
//   invariants      不变量登记表
//   acceptance      验收测试文件；每条「测试」档不变量都要在这里有以编号开头的用例
export const GovernedModules = [
  {
    // ui 的单元：HTML 工件（原独立包 @velaros-ai/html-artifacts，ADR 0014）；单元目录住在 src/ 下，与 ui 自己的组件同在 src，
    // 组件不在这张登记表里
    unit: 'html-artifacts',
    root: 'src/html-artifacts',
    name: '@velaros-ai/ui/html-artifacts',
    // 没有工具：这是一个浏览器库，不向模型交工具，不登记 toolsFile、toolDefiner、hostPort
    contract: 'src/html-artifacts/contract',
    types: 'src/html-artifacts/types',
    portable: 'html-artifacts.ts',
    impl: 'src/html-artifacts/impl',
    utils: 'src/html-artifacts/utils',
    tuning: 'tuning.ts',
    // 零运行时依赖的浏览器库：两个入口渲染进程与浏览器扩展都能加载
    browserSafeEntries: ['index.ts', 'contracts.ts'],
    layers: [
      // 沙箱文档这件能力的唯一出口
      ['HtmlArtifactDocuments.ts'],
    ],
    card: 'src/html-artifacts/MODULE.md',
    invariants: 'src/html-artifacts/spec/invariants.md',
    acceptance: 'src/html-artifacts/spec/acceptance.test.ts',
  },
]

/** 模块卡片必须有的十节标题，顺序不限。 */
export const RequiredCardSections = [
  '这是什么',
  '提供什么',
  '骨干链路',
  '依赖什么',
  '状态归谁',
  '生命周期',
  '失败语义',
  '不变量',
  '非目标',
  '结构',
]

/** 不变量的五档检验方式。「文字」档没有检验器，在卡片里必须计入「未验证」。 */
export const InvariantCheckKinds = ['测试', '类型', '门禁', '运行时', '文字']
