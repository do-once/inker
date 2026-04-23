import { describe, it, expect } from 'vitest'
import { colorToRGB } from '../color.util'

describe('colorToRGB', () => {
  describe('解析 hex 颜色', () => {
    it('解析 3 位 hex（如 #f00 → { r: 255, g: 0, b: 0 }）', () => {
      const result = colorToRGB('#f00')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('解析 3 位 hex #0f0', () => {
      const result = colorToRGB('#0f0')
      expect(result).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    })

    it('解析 3 位 hex #00f', () => {
      const result = colorToRGB('#00f')
      expect(result).toEqual({ r: 0, g: 0, b: 255, a: 1 })
    })

    it('解析 6 位 hex（如 #ff0000）', () => {
      const result = colorToRGB('#ff0000')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('解析 6 位 hex #00ff00', () => {
      const result = colorToRGB('#00ff00')
      expect(result).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    })

    it('解析 6 位 hex #808080（灰色）', () => {
      const result = colorToRGB('#808080')
      expect(result).toEqual({ r: 128, g: 128, b: 128, a: 1 })
    })

    it('解析带 alpha 的 8 位 hex（如 #ff000080）', () => {
      const result = colorToRGB('#ff000080')
      expect(result.r).toBe(255)
      expect(result.g).toBe(0)
      expect(result.b).toBe(0)
      // 0x80 = 128, 128/255 ≈ 0.502
      expect(result.a).toBeCloseTo(128 / 255, 2)
    })

    it('解析带 alpha 的 8 位 hex #00ff00ff（完全不透明）', () => {
      const result = colorToRGB('#00ff00ff')
      expect(result).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    })

    it('解析带 alpha 的 8 位 hex #00000000（完全透明）', () => {
      const result = colorToRGB('#00000000')
      expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    })

    it('解析大写 hex', () => {
      const result = colorToRGB('#FF0000')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })
  })

  describe('解析 rgb() 格式', () => {
    it('解析 rgb(255, 0, 0)', () => {
      const result = colorToRGB('rgb(255, 0, 0)')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    it('解析无空格的 rgb(0,128,255)', () => {
      const result = colorToRGB('rgb(0,128,255)')
      expect(result).toEqual({ r: 0, g: 128, b: 255, a: 1 })
    })

    it('解析边界值 rgb(0, 0, 0)（黑色）', () => {
      const result = colorToRGB('rgb(0, 0, 0)')
      expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    })

    it('解析边界值 rgb(255, 255, 255)（白色）', () => {
      const result = colorToRGB('rgb(255, 255, 255)')
      expect(result).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    })
  })

  describe('解析 rgba() 格式', () => {
    it('解析 rgba(255, 0, 0, 0.5)', () => {
      const result = colorToRGB('rgba(255, 0, 0, 0.5)')
      expect(result).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    })

    it('解析 rgba(0, 128, 255, 1)', () => {
      const result = colorToRGB('rgba(0, 128, 255, 1)')
      expect(result).toEqual({ r: 0, g: 128, b: 255, a: 1 })
    })

    it('解析 rgba(0, 0, 0, 0)（完全透明）', () => {
      const result = colorToRGB('rgba(0, 0, 0, 0)')
      expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    })

    it('解析无空格的 rgba(128,64,32,0.75)', () => {
      const result = colorToRGB('rgba(128,64,32,0.75)')
      expect(result).toEqual({ r: 128, g: 64, b: 32, a: 0.75 })
    })
  })

  describe('非法值处理', () => {
    it('空字符串抛错或返回默认值', () => {
      expect(() => colorToRGB('')).toThrow()
    })

    it('无效格式抛错或返回默认值', () => {
      expect(() => colorToRGB('not-a-color')).toThrow()
    })

    it('不完整的 hex 抛错或返回默认值', () => {
      expect(() => colorToRGB('#fg')).toThrow()
    })

    it('超出范围的 rgb 值抛错或返回默认值', () => {
      expect(() => colorToRGB('rgb(300, 0, 0)')).toThrow()
    })
  })
})
