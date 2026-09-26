/**
 * 包内的工作类型：URL 构造器的最小形状。
 * 都不出包——它们是实现自己的形状，不在任何公开签名里。
 */

/** `URL` 实例里本包真正会读的两项。 */
export interface UrlLike {
  /** 归一化之后的完整地址。 */
  href: string
  /** 协议名，带结尾冒号。 */
  protocol: string
}

/** `URL` 构造器的最小形状：宿主环境没有它时就直接拒绝外链。 */
export interface UrlConstructorLike {
  /** 按一段文本造一个 URL；造不出来时按约定抛错。 */
  new (input: string): UrlLike
}
