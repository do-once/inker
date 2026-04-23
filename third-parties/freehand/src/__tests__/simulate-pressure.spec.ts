import { describe, it, expect } from 'vitest'
import { simulatePressure } from '../simulate-pressure'

describe('simulatePressure', () => {
  describe('输出范围', () => {
    it('输出压力值在 0-1 范围内', () => {
      const result = simulatePressure(0.5, 10, 16)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('极端输入下仍在 0-1 范围内', () => {
      // 极大距离
      const r1 = simulatePressure(0, 10000, 16)
      expect(r1).toBeGreaterThanOrEqual(0)
      expect(r1).toBeLessThanOrEqual(1)

      // 零距离
      const r2 = simulatePressure(0.5, 0, 16)
      expect(r2).toBeGreaterThanOrEqual(0)
      expect(r2).toBeLessThanOrEqual(1)

      // 满压力
      const r3 = simulatePressure(1, 5, 16)
      expect(r3).toBeGreaterThanOrEqual(0)
      expect(r3).toBeLessThanOrEqual(1)

      // 零压力
      const r4 = simulatePressure(0, 5, 16)
      expect(r4).toBeGreaterThanOrEqual(0)
      expect(r4).toBeLessThanOrEqual(1)
    })
  })

  describe('距离与压力关系', () => {
    it('不同距离产生不同压力值', () => {
      const shortDist = simulatePressure(0.5, 1, 16)
      const longDist = simulatePressure(0.5, 50, 16)
      // 短距离和长距离应产生不同结果
      expect(shortDist).not.toBe(longDist)
    })

    it('距离为 0 时压力趋向较高值', () => {
      // 零距离意味着静止/缓慢，压力应趋高
      const result = simulatePressure(0.5, 0, 16)
      expect(result).toBeGreaterThanOrEqual(0.5)
    })

    it('极大距离时压力变化受限', () => {
      // 速度很快时，sp 趋向 1，rp 趋向 0
      const result = simulatePressure(0.5, 1000, 16)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })
  })

  describe('压力趋势', () => {
    it('从低压力开始逐步增加（模拟缓慢绘制）', () => {
      let pressure = 0.25
      const smallDistance = 2
      const size = 16

      // 模拟缓慢绘制（小距离），压力应逐渐增加
      const pressures: number[] = []
      for (let i = 0; i < 10; i++) {
        pressure = simulatePressure(pressure, smallDistance, size)
        pressures.push(pressure)
      }

      // 压力应在上升或稳定
      expect(pressures[pressures.length - 1]).toBeGreaterThanOrEqual(pressures[0])
    })

    it('连续调用输出逐渐收敛', () => {
      let pressure = 0.25
      const distance = 5
      const size = 16

      const pressures: number[] = []
      for (let i = 0; i < 50; i++) {
        pressure = simulatePressure(pressure, distance, size)
        pressures.push(pressure)
      }

      // 最后几个值应该非常接近（收敛）
      const last = pressures[pressures.length - 1]
      const secondLast = pressures[pressures.length - 2]
      expect(Math.abs(last - secondLast)).toBeLessThan(0.01)
    })
  })

  describe('size 参数影响', () => {
    it('相同距离下不同 size 产生不同压力', () => {
      const smallSize = simulatePressure(0.5, 10, 8)
      const largeSize = simulatePressure(0.5, 10, 32)
      expect(smallSize).not.toBe(largeSize)
    })
  })
})
