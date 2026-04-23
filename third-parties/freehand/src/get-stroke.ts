import type { StrokeOptions, Vec2 } from './types'
import { getStrokeOutlinePoints } from './get-stroke-outline-points'
import { getStrokePoints } from './get-stroke-points'

/**
 * ## getStroke
 * @description 获取描述输入点周围多边形轮廓的点数组。
 * @param points 输入点数组（支持 `[x, y, pressure]` 或 `{x, y, pressure}` 格式），pressure 可选。
 * @param options （可选）配置对象。
 * @param options.size 笔画基准大小（直径）。
 * @param options.thinning 压感对笔画粗细的影响程度。
 * @param options.smoothing 笔画边缘平滑程度。
 * @param options.easing 应用于每个点压力值的缓动函数。
 * @param options.simulatePressure 是否根据速度模拟压力。
 * @param options.start 线条起始处的端帽、渐细和缓动配置。
 * @param options.end 线条结束处的端帽、渐细和缓动配置。
 * @param options.last 是否将输入点视为已完成的笔画。
 */
export function getStroke(
  points: (number[] | { x: number; y: number; pressure?: number })[],
  options: StrokeOptions = {} as StrokeOptions
): Vec2[] {
  return getStrokeOutlinePoints(getStrokePoints(points, options), options)
}
