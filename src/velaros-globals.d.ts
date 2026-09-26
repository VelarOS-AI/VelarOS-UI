/**
 * 本包源码共用的全局 TypeScript **类型别名**（只在编译期存在，没有运行时）。
 *
 * 只在仓内生效：源码、测试与组件图鉴直接用。构建后 `scripts/build/normalize-package-declarations.mjs`
 * 把声明文件里用到的别名改成从 `@velaros-ai/ui/utility-types` 导入，发布的包不装任何全局类型。
 *
 * 全局空占位：`undefined` 与 `null`。
 * 新代码优先用 `undefined`；仅在 JSON／IPC、DOM/React ref、序列化必须用 `null` 时写 `null`。
 */
type Nullish = undefined | null
/** 显式的 `undefined` 缺席值；属性本身可省略时仍优先使用 `?`。 */
type Optional<T> = T | undefined
type Nullable<T> = T | null
type PlainObject = Record<string, unknown>
type JsonStringifyReplacerValue =
  | ((this: any, key: string, value: any) => any)
  | Array<string | number>
type JsonStringifyReplacer = Nullable<JsonStringifyReplacerValue>

type LooseOptional<T> = T | Nullish
