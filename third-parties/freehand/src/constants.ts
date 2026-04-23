/**
 * 笔画生成算法使用的常量。
 * @internal
 */

const { PI } = Math

/**
 * 模拟压力的变化速率。
 * 控制压力随绘制速度变化的响应灵敏度。
 * 值越大，压力对速度变化的响应越敏感。
 */
export const RATE_OF_PRESSURE_CHANGE = 0.275

/**
 * 带微小偏移的 PI 值，用于修复浏览器渲染伪影。
 * 某些浏览器在使用精确 PI 值时会渲染出异常笔画。
 */
export const FIXED_PI = PI + 0.0001

/**
 * 起始圆形端帽的分段数。
 */
export const START_CAP_SEGMENTS = 13

/**
 * 结束圆形端帽的分段数。
 * 比起始端帽更多，以获得更平滑的笔画结尾外观。
 */
export const END_CAP_SEGMENTS = 29

/**
 * 尖角端帽的分段数。
 */
export const CORNER_CAP_SEGMENTS = 13

/**
 * 笔画末端跳过的像素数，用于减少噪声。
 */
export const END_NOISE_THRESHOLD = 3

/**
 * 流线最小插值因子。
 * 当 streamline 为最大值（1.0）时使用。
 */
export const MIN_STREAMLINE_T = 0.15

/**
 * 插值因子的计算范围。
 * 基于 (1 - streamline) 加到 MIN_STREAMLINE_T 上。
 */
export const STREAMLINE_T_RANGE = 0.85

/**
 * 最小笔画半径，防止笔画不可见。
 */
export const MIN_RADIUS = 0.01

/**
 * 笔画第一个点的默认压力值。
 * 低于后续点的压力，以防止起笔过粗，
 * 因为手绘线条几乎总是从缓慢开始。
 */
export const DEFAULT_FIRST_PRESSURE = 0.25

/**
 * 未提供压力值时后续点的默认压力。
 */
export const DEFAULT_PRESSURE = 0.5

/**
 * 单位偏移向量，用作初始向量的占位符，
 * 以及在仅提供一个点时创建第二个点。
 */
export const UNIT_OFFSET: [number, number] = [1, 1]
