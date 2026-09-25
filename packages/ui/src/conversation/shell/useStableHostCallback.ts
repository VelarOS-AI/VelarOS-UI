import { useMemoizedFn } from 'ahooks'

/**
 * 宿主回调固定成稳定引用再交给消息气泡。气泡按引用判等，宿主每次渲染新建一个回调（内联箭头、
 * 组件里的普通函数）就会让整段对话随每个 token 重画；这里只保留「传没传」的变化（没传时气泡
 * 不画对应入口），调用时总是转给宿主最新的那一个。
 */
export function useStableHostCallback<Args extends unknown[], Result>(
  callback?: (...args: Args) => Result
): Optional<(...args: Args) => Result> {
  const stable = useMemoizedFn((...args: Args): Result => callback!(...args))
  return callback ? stable : undefined
}
