/**
 * 零依赖的运行时守卫：本包对外承诺「零运行时依赖的浏览器库」，不能反向依赖 `@velaros-ai/core`，
 * 所以在这里自带一份最小实现。判定一律用 `typeof` / `Object.prototype.toString`，不用 `instanceof`。
 */

/** 判断未知值是不是有限正数。 */
export function isFinitePositiveNumber(value: unknown): value is number {
  // @arch-guard:suspend code-style/prefer-is-finite-number-guard 理由：html-artifacts 保持零运行时依赖，无法导入 core 的 isFiniteNumber。
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** 判断未知值是不是字符串原始值。 */
export function isString(value: unknown): value is string {
  return Object.prototype.toString.call(value) === '[object String]' && Object(value) !== value
}
