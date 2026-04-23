import { describe, it, expect } from 'vitest'
import { round } from '../round.util'

describe('round', () => {
  describe('默认精度', () => {
    it('默认精度四舍五入（无小数）', () => {
      expect(round(3.7)).toBe(4)
    })

    it('默认精度四舍（向下）', () => {
      expect(round(3.2)).toBe(3)
    })

    it('默认精度 0.5 进位', () => {
      expect(round(3.5)).toBe(4)
    })
  })

  describe('指定小数位数', () => {
    it('保留 1 位小数', () => {
      expect(round(3.14159, 1)).toBe(3.1)
    })

    it('保留 2 位小数', () => {
      expect(round(3.14159, 2)).toBe(3.14)
    })

    it('保留 3 位小数', () => {
      expect(round(3.14159, 3)).toBe(3.142)
    })

    it('保留 4 位小数', () => {
      expect(round(3.14159, 4)).toBe(3.1416)
    })

    it('精度为 0 时等同于默认行为', () => {
      expect(round(3.7, 0)).toBe(4)
    })
  })

  describe('边界值', () => {
    it('输入 0 返回 0', () => {
      expect(round(0)).toBe(0)
      expect(round(0, 2)).toBe(0)
    })

    it('负数四舍五入', () => {
      expect(round(-3.7)).toBe(-4)
      expect(round(-3.2)).toBe(-3)
    })

    it('负数保留小数位', () => {
      expect(round(-3.14159, 2)).toBe(-3.14)
    })

    it('极大值', () => {
      expect(round(1e15 + 0.5)).toBe(1e15 + 1)
    })

    it('极小正数', () => {
      expect(round(0.0001, 3)).toBe(0)
      expect(round(0.0005, 3)).toBe(0.001)
    })

    it('整数输入原样返回', () => {
      expect(round(42)).toBe(42)
      expect(round(42, 2)).toBe(42)
    })

    it('已满足精度的数值原样返回', () => {
      expect(round(3.14, 5)).toBe(3.14)
    })
  })
})
