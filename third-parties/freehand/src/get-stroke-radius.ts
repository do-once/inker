/**
 * 根据压力值计算笔画半径。
 * @param size 笔画基准大小
 * @param thinning 压感影响程度
 * @param pressure 当前压力值
 * @param easing 缓动函数
 * @internal
 */
export function getStrokeRadius(
  size: number,
  thinning: number,
  pressure: number,
  easing: (t: number) => number = (t) => t
) {
  return size * easing(0.5 - thinning * (0.5 - pressure))
}
