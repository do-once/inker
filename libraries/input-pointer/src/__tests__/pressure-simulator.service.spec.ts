import { describe, it, expect } from 'vitest'
import { PressureSimulator } from '../pressure-simulator.service'

describe('PressureSimulator', () => {
  describe('compute — 基于距离计算压力', () => {
    it('距离越大压力越小', () => {
      const simulator = new PressureSimulator()

      // 首个点
      simulator.compute(0, 0)
      // 短距离
      const pShort = simulator.compute(2, 2)
      // 长距离
      const pLong = simulator.compute(60, 62)

      expect(pLong).toBeLessThan(pShort)
    })

    it('首个点应返回默认压力值（约 0.75）', () => {
      const simulator = new PressureSimulator()

      const pressure = simulator.compute(0, 0)

      expect(pressure).toBeCloseTo(0.75, 1)
    })

    it('连续短距离移动压力应趋向 1', () => {
      const simulator = new PressureSimulator()

      simulator.compute(0, 0) // 首点
      let lastPressure = 0
      // 连续短距离移动
      for (let i = 1; i <= 20; i++) {
        lastPressure = simulator.compute(1, i)
      }

      // 短距离对应高压力
      expect(lastPressure).toBeGreaterThan(0.8)
    })

    it('连续长距离移动压力应趋向最小值', () => {
      const simulator = new PressureSimulator()

      simulator.compute(0, 0) // 首点
      let lastPressure = 1
      // 连续大距离移动
      for (let i = 1; i <= 10; i++) {
        lastPressure = simulator.compute(60, i * 60)
      }

      // 长距离对应低压力
      expect(lastPressure).toBeLessThan(0.5)
    })
  })

  describe('平滑步进限制', () => {
    it('压力变化不应超过步长限制', () => {
      const simulator = new PressureSimulator()

      // 首点
      const p0 = simulator.compute(0, 0)
      // 突然来一个较长距离（应触发较大压力变化）
      const p1 = simulator.compute(20, 20)

      // 步长限制为 0.02，压力变化不超过步长
      // 如果距离 < 30，则 diff 被限制
      const diff = Math.abs(p1 - p0)
      expect(diff).toBeLessThanOrEqual(0.02 + 1e-10) // 允许浮点误差
    })

    it('多步后压力应逐渐变化而非跳变', () => {
      const simulator = new PressureSimulator()

      simulator.compute(0, 0) // 首点

      const pressures: number[] = []
      // 从短距离突然变为长距离
      for (let i = 1; i <= 5; i++) {
        pressures.push(simulator.compute(1, i))
      }
      for (let i = 6; i <= 15; i++) {
        pressures.push(simulator.compute(40, i * 40))
      }

      // 验证每步变化不超过步长
      for (let i = 1; i < pressures.length; i++) {
        const step = Math.abs(pressures[i] - pressures[i - 1])
        // 距离 >= 30 时不受步长限制，距离 < 30 时受限
        // 这里只验证整体趋势是逐渐变化的
        expect(step).toBeLessThan(0.5)
      }
    })
  })

  describe('压力范围', () => {
    it('压力值始终在 0-1 范围内', () => {
      const simulator = new PressureSimulator()

      const pressures: number[] = []
      pressures.push(simulator.compute(0, 0))

      // 各种距离
      const distances = [0, 1, 2, 5, 10, 20, 50, 100, 200]
      let cumulative = 0
      for (const d of distances) {
        cumulative += d
        pressures.push(simulator.compute(d, cumulative))
      }

      for (const p of pressures) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    })

    it('极端距离值不应产生 NaN', () => {
      const simulator = new PressureSimulator()
      simulator.compute(0, 0)

      const p = simulator.compute(10000, 10000)

      expect(p).not.toBeNaN()
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    })
  })

  describe('reset — 重置状态', () => {
    it('重置后首个点应返回默认压力值', () => {
      const simulator = new PressureSimulator()

      simulator.compute(0, 0)
      simulator.compute(10, 10)
      simulator.compute(20, 20)

      simulator.reset()

      const pressure = simulator.compute(0, 0)
      expect(pressure).toBeCloseTo(0.75, 1)
    })
  })
})
