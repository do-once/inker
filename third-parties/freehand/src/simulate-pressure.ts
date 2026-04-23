import { RATE_OF_PRESSURE_CHANGE } from './constants'

const { min } = Math

/**
 * 基于点间距离和笔画大小模拟压力值。
 * 根据绘制速度创建自然的压感效果。
 *
 * @param prevPressure 上一个压力值
 * @param distance 与上一个点的距离
 * @param size 笔画基准大小
 * @returns 模拟的压力值（0-1）
 * @internal
 */
export function simulatePressure(
  prevPressure: number,
  distance: number,
  size: number
): number {
  // 速度因子 — 压力变化的速度
  const sp = min(1, distance / size)
  // 变化量 — 变化的幅度
  const rp = min(1, 1 - sp)
  // 加速压力
  return min(
    1,
    prevPressure + (rp - prevPressure) * (sp * RATE_OF_PRESSURE_CHANGE)
  )
}
