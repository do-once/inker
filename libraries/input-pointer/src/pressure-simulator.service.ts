/**
 * 压力模拟器
 * 基于点间距离/速度模拟压力值，带平滑步进限制
 */
export class PressureSimulator {
  /** 上一次的压力值 */
  private lastPressure: number = -1
  /** 是否为首个点 */
  private isFirstPoint: boolean = true
  /** 平滑步进限制 */
  private static readonly STEP_LIMIT = 0.02

  /**
   * 基于距离计算模拟压力值
   * @param distance 与上一个点的距离
   * @param cumulativeLength 累计长度
   * @returns 压力值（0-1）
   */
  compute(distance: number, cumulativeLength: number): number {
    // 首个点返回默认压力
    if (this.isFirstPoint) {
      this.isFirstPoint = false
      this.lastPressure = 0.75
      return this.lastPressure
    }

    // 计算基础压力比率
    let ratio = 1
    if (cumulativeLength === 0) {
      ratio = 0.75
    } else if (distance === cumulativeLength) {
      ratio = 1
    } else if (distance < 3) {
      ratio = 1.25
    } else if (distance < 10) {
      ratio = Math.pow(0.1 * distance, -0.1)
    } else if (distance > 50) {
      ratio = 0.9
    }

    const f = ratio * Math.max(0.25, 1.0 - 0.1 * Math.pow(distance, 0.4))
    let pressure = Number.isNaN(f) ? 0.5 : f

    // 限制在 0-1 范围
    pressure = Math.max(0, Math.min(1, pressure))

    // 平滑步进限制（距离小于 30 时）
    if (distance < 30) {
      const diff = pressure - this.lastPressure
      if (Math.abs(diff) > PressureSimulator.STEP_LIMIT) {
        pressure = this.lastPressure + Math.sign(diff) * PressureSimulator.STEP_LIMIT
      }
    }

    // 再次限制范围
    pressure = Math.max(0, Math.min(1, pressure))

    this.lastPressure = pressure
    return pressure
  }

  /**
   * 重置模拟器状态
   */
  reset(): void {
    this.lastPressure = -1
    this.isFirstPoint = true
  }
}
