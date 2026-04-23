/**
 * 二维向量，以固定长度元组 [x, y] 表示。
 */
export type Vec2 = [number, number]

/**
 * `getStroke` 或 `getStrokePoints` 的配置选项。
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
export interface StrokeOptions {
  size?: number
  thinning?: number
  smoothing?: number
  streamline?: number
  easing?: (pressure: number) => number
  simulatePressure?: boolean
  start?: {
    cap?: boolean
    taper?: number | boolean
    easing?: (distance: number) => number
  }
  end?: {
    cap?: boolean
    taper?: number | boolean
    easing?: (distance: number) => number
  }
  /** 是否将输入点视为已完成的笔画 */
  last?: boolean
}

/**
 * `getStrokePoints` 返回的笔画点结构，同时也是 `getStrokeOutlinePoints` 的输入。
 */
export interface StrokePoint {
  point: Vec2
  pressure: number
  distance: number
  vector: Vec2
  runningLength: number
}
