import { describe, it, expect } from 'vitest'
import { add, sub, mul, div, per, len, uni, dist, lrp, neg, med, dpr, isEqual } from '../vec'
import type { Vec2 } from '../types'

describe('向量工具函数', () => {
  describe('add（向量加法）', () => {
    it('两个正向量相加', () => {
      expect(add([1, 2], [3, 4])).toEqual([4, 6])
    })

    it('零向量加法', () => {
      expect(add([1, 2], [0, 0])).toEqual([1, 2])
    })

    it('负向量加法', () => {
      expect(add([1, 2], [-1, -2])).toEqual([0, 0])
    })
  })

  describe('sub（向量减法）', () => {
    it('两个向量相减', () => {
      expect(sub([4, 6], [1, 2])).toEqual([3, 4])
    })

    it('相同向量相减为零向量', () => {
      expect(sub([3, 5], [3, 5])).toEqual([0, 0])
    })
  })

  describe('neg（向量取反）', () => {
    it('正向量取反', () => {
      expect(neg([3, 4])).toEqual([-3, -4])
    })

    it('零向量取反', () => {
      expect(neg([0, 0])).toEqual([-0, -0])
    })
  })

  describe('mul（标量乘法）', () => {
    it('向量乘以标量', () => {
      expect(mul([2, 3], 3)).toEqual([6, 9])
    })

    it('乘以 0 得零向量', () => {
      expect(mul([2, 3], 0)).toEqual([0, 0])
    })

    it('乘以 1 得原向量', () => {
      expect(mul([2, 3], 1)).toEqual([2, 3])
    })

    it('乘以负数', () => {
      expect(mul([2, 3], -1)).toEqual([-2, -3])
    })
  })

  describe('div（标量除法）', () => {
    it('向量除以标量', () => {
      expect(div([6, 9], 3)).toEqual([2, 3])
    })

    it('除以 1 得原向量', () => {
      expect(div([2, 3], 1)).toEqual([2, 3])
    })
  })

  describe('per（法向量 / 垂直旋转）', () => {
    it('水平向量的法向量', () => {
      expect(per([1, 0])).toEqual([0, -1])
    })

    it('垂直向量的法向量', () => {
      expect(per([0, 1])).toEqual([1, 0])
    })

    it('一般向量的法向量', () => {
      const result = per([3, 4])
      expect(result).toEqual([4, -3])
    })

    it('法向量与原向量正交（点积为 0）', () => {
      const v: Vec2 = [3, 4]
      const p = per(v)
      const dot = dpr(v, p)
      expect(dot).toBe(0)
    })
  })

  describe('len（向量长度）', () => {
    it('3-4-5 直角三角形', () => {
      expect(len([3, 4])).toBe(5)
    })

    it('零向量长度为 0', () => {
      expect(len([0, 0])).toBe(0)
    })

    it('单位向量长度为 1', () => {
      expect(len([1, 0])).toBe(1)
      expect(len([0, 1])).toBe(1)
    })
  })

  describe('uni（单位向量）', () => {
    it('非零向量的单位向量长度为 1', () => {
      const result = uni([3, 4])
      expect(len(result)).toBeCloseTo(1, 10)
    })

    it('单位向量方向与原向量一致', () => {
      const v: Vec2 = [3, 4]
      const u = uni(v)
      // 方向一致：分量比例相同
      expect(u[0] / u[1]).toBeCloseTo(v[0] / v[1], 10)
    })

    it('已是单位向量的输入原样返回', () => {
      const result = uni([1, 0])
      expect(result[0]).toBeCloseTo(1)
      expect(result[1]).toBeCloseTo(0)
    })
  })

  describe('dist（两点距离）', () => {
    it('相同点距离为 0', () => {
      expect(dist([5, 5], [5, 5])).toBe(0)
    })

    it('水平距离', () => {
      expect(dist([0, 0], [3, 0])).toBe(3)
    })

    it('3-4-5 直角三角形距离', () => {
      expect(dist([0, 0], [3, 4])).toBe(5)
    })

    it('对称性：dist(A,B) === dist(B,A)', () => {
      expect(dist([1, 2], [4, 6])).toBe(dist([4, 6], [1, 2]))
    })
  })

  describe('lrp（线性插值）', () => {
    it('t=0 返回 A', () => {
      expect(lrp([0, 0], [10, 10], 0)).toEqual([0, 0])
    })

    it('t=1 返回 B', () => {
      expect(lrp([0, 0], [10, 10], 1)).toEqual([10, 10])
    })

    it('t=0.5 返回中点', () => {
      expect(lrp([0, 0], [10, 10], 0.5)).toEqual([5, 5])
    })

    it('t=0.25 返回 1/4 处', () => {
      const result = lrp([0, 0], [20, 40], 0.25)
      expect(result[0]).toBeCloseTo(5)
      expect(result[1]).toBeCloseTo(10)
    })
  })

  describe('med（中点）', () => {
    it('两点的中点', () => {
      expect(med([0, 0], [10, 10])).toEqual([5, 5])
    })

    it('相同点的中点是自身', () => {
      expect(med([5, 5], [5, 5])).toEqual([5, 5])
    })
  })

  describe('dpr（点积）', () => {
    it('正交向量点积为 0', () => {
      expect(dpr([1, 0], [0, 1])).toBe(0)
    })

    it('平行同向向量点积为正', () => {
      expect(dpr([1, 0], [3, 0])).toBe(3)
    })

    it('平行反向向量点积为负', () => {
      expect(dpr([1, 0], [-3, 0])).toBe(-3)
    })
  })

  describe('isEqual（向量相等）', () => {
    it('相同向量返回 true', () => {
      expect(isEqual([1, 2], [1, 2])).toBe(true)
    })

    it('不同向量返回 false', () => {
      expect(isEqual([1, 2], [1, 3])).toBe(false)
    })
  })
})
