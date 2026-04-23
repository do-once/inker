import {
  DEFAULT_FIRST_PRESSURE,
  DEFAULT_PRESSURE,
  MIN_STREAMLINE_T,
  STREAMLINE_T_RANGE,
  UNIT_OFFSET,
} from './constants'
import type { StrokeOptions, StrokePoint, Vec2 } from './types'
import { add, dist, isEqual, lrp, subInto, uni } from './vec'

/** 用于热循环中无分配向量计算的临时缓冲区 */
const _vectorDiff: Vec2 = [0, 0]

/**
 * 检查压力值是否有效（已定义且非负）。
 * 对 undefined、NaN 和负值返回 false。
 */
function isValidPressure(pressure: number | undefined): pressure is number {
  return pressure != null && pressure >= 0
}

/**
 * ## getStrokePoints
 * @description 将输入点转换为带有调整后坐标、压力、方向向量、距离和累计长度的笔画点数组。
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
export function getStrokePoints<
  T extends number[],
  K extends { x: number; y: number; pressure?: number },
>(points: (T | K)[], options = {} as StrokeOptions): StrokePoint[] {
  const { streamline = 0.5, size = 16, last: isComplete = false } = options

  // 空点集直接返回空数组
  if (points.length === 0) return []

  // 根据 streamline 计算点间插值级别
  const t = MIN_STREAMLINE_T + (1 - streamline) * STREAMLINE_T_RANGE

  // 无论输入格式如何，统一转换为 number[][] 格式
  let pts = Array.isArray(points[0])
    ? (points as T[])
    : (points as K[]).map(({ x, y, pressure = DEFAULT_PRESSURE }) => [
        x,
        y,
        pressure,
      ])

  // 在两个点之间添加额外的插值点，避免渐细笔画出现"虚线"效果
  // 不修改输入数组！
  if (pts.length === 2) {
    const last = pts[1]
    pts = pts.slice(0, -1)
    for (let i = 1; i < 5; i++) {
      pts.push(lrp(pts[0] as Vec2, last as Vec2, i / 4))
    }
  }

  // 如果只有一个点，在偏移 1pt 处添加第二个点
  // 不修改输入数组！
  if (pts.length === 1) {
    pts = [...pts, [...add(pts[0] as Vec2, UNIT_OFFSET), ...pts[0].slice(2)]]
  }

  // strokePoints 数组存储笔画点
  // 从第一个点开始，无需调整
  const strokePoints: StrokePoint[] = [
    {
      point: [pts[0][0], pts[0][1]],
      pressure: isValidPressure(pts[0][2]) ? pts[0][2] : DEFAULT_FIRST_PRESSURE,
      vector: [...UNIT_OFFSET],
      distance: 0,
      runningLength: 0,
    },
  ]

  // 标记是否已达到最小长度
  let hasReachedMinimumLength = false

  // 使用 runningLength 跟踪总距离
  let runningLength = 0

  // 记录最新的点，用于计算下一个点的距离和方向向量
  let prev = strokePoints[0]

  const max = pts.length - 1

  // 遍历所有点，创建 StrokePoint
  for (let i = 1; i < pts.length; i++) {
    const point: Vec2 =
      isComplete && i === max
        ? // 如果是最后一个点且 options.last 为 true，使用实际输入点
          [pts[i][0], pts[i][1]]
        : // 否则，使用 streamline 计算的 t 值在前一个点和当前点之间插值
          lrp(prev.point, pts[i] as Vec2, t)

    // 如果新点与前一个点相同，跳过
    if (isEqual(prev.point, point)) continue

    // 新点与前一个点的距离
    const distance = dist(point, prev.point)

    // 将距离加到线条的"累计长度"上
    runningLength += distance

    // 在线条起始处，等待新点与原始点有一定距离，以避免噪声
    if (i < max && !hasReachedMinimumLength) {
      if (runningLength < size) continue
      hasReachedMinimumLength = true
    }

    // 创建新的 StrokePoint（它将成为新的"前一个"点）
    // 使用临时缓冲区计算方向向量差，减少内存分配
    subInto(_vectorDiff, prev.point, point)
    prev = {
      // 调整后的点
      point,
      // 输入压力（未指定时使用默认值）
      pressure: isValidPressure(pts[i][2]) ? pts[i][2] : DEFAULT_PRESSURE,
      // 从当前点到前一个点的方向向量
      vector: uni(_vectorDiff),
      // 当前点与前一个点的距离
      distance,
      // 累计总距离
      runningLength,
    }

    // 添加到 strokePoints 数组
    strokePoints.push(prev)
  }

  // 将第一个点的方向向量设为与第二个点相同
  strokePoints[0].vector = strokePoints[1]?.vector || [0, 0]

  return strokePoints
}
