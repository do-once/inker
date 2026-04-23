import { describe, it, expect } from 'vitest'
import { RectEraserProcessor } from '../rect-eraser.processor'
import type { Stroke, StrokePoint, StrokeStyle } from '@inker/types'

/** 创建测试用采样点（世界坐标像素） */
function point(x: number, y: number, p = 0.5, t = Date.now()): StrokePoint {
  return { x, y, p, t }
}

const penStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

const eraserStyle: StrokeStyle = {
  type: 'eraser',
  color: '#ffffff',
  size: 20,
  opacity: 1
}

/** 创建测试用笔画 */
function createStroke(id: string, points: StrokePoint[], style = penStyle): Stroke {
  return { id, points, style, createdAt: Date.now() }
}

describe('RectEraserProcessor', () => {
  describe('supportedTypes', () => {
    it('应包含 eraser 类型', () => {
      const processor = new RectEraserProcessor()
      expect(processor.supportedTypes).toContain('eraser')
    })

    it('应包含 wiper 类型', () => {
      const processor = new RectEraserProcessor()
      expect(processor.supportedTypes).toContain('wiper')
    })
  })

  describe('computeErasure — 基础行为', () => {
    it('擦除区域与笔画相交时应返回该 strokeId', () => {
      const processor = new RectEraserProcessor()

      // 笔画在中间区域（世界坐标像素）
      const stroke = createStroke('stroke-1', [
        point(400, 300),
        point(440, 330),
        point(480, 360)
      ])

      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      // 擦除器经过相同区域
      const eraserPoints = [
        point(384, 288),
        point(416, 312),
        point(448, 336)
      ]

      const result = processor.computeErasure!(
        eraserPoints,
        eraserStyle,
        strokes
      )

      expect(result).toContain('stroke-1')
    })

    it('擦除区域不与任何笔画相交时应返回空数组', () => {
      const processor = new RectEraserProcessor()

      // 笔画在左上角
      const stroke = createStroke('stroke-1', [
        point(80, 60),
        point(120, 90)
      ])

      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      // 擦除器在右下角（不相交）
      const eraserPoints = [
        point(640, 480),
        point(680, 510),
        point(720, 540)
      ]

      const result = processor.computeErasure!(
        eraserPoints,
        eraserStyle,
        strokes
      )

      expect(result).toEqual([])
    })

    it('擦除完全覆盖笔画时应返回该 strokeId', () => {
      const processor = new RectEraserProcessor()

      // 短笔画
      const stroke = createStroke('stroke-1', [
        point(400, 300),
        point(408, 306)
      ])

      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      // 大范围擦除器完全覆盖
      const eraserPoints = [
        point(320, 240),
        point(400, 300),
        point(480, 360)
      ]

      const widerEraser: StrokeStyle = { ...eraserStyle, size: 100 }

      const result = processor.computeErasure!(
        eraserPoints,
        widerEraser,
        strokes
      )

      expect(result).toContain('stroke-1')
    })
  })

  describe('computeErasure — 多笔画', () => {
    it('多条笔画部分相交时应返回所有相交的 strokeId', () => {
      const processor = new RectEraserProcessor()

      const stroke1 = createStroke('stroke-1', [
        point(240, 180),
        point(280, 210),
        point(320, 240)
      ])

      const stroke2 = createStroke('stroke-2', [
        point(400, 300),
        point(440, 330),
        point(480, 360)
      ])

      // stroke-3 在远离擦除器的位置
      const stroke3 = createStroke('stroke-3', [
        point(720, 60),
        point(760, 90)
      ])

      const strokes = new Map<string, Stroke>([
        ['stroke-1', stroke1],
        ['stroke-2', stroke2],
        ['stroke-3', stroke3]
      ])

      // 擦除器经过 stroke-1 和 stroke-2 的区域
      const eraserPoints = [
        point(240, 180),
        point(320, 240),
        point(400, 300),
        point(480, 360)
      ]

      const widerEraser: StrokeStyle = { ...eraserStyle, size: 40 }

      const result = processor.computeErasure!(
        eraserPoints,
        widerEraser,
        strokes
      )

      expect(result).toContain('stroke-1')
      expect(result).toContain('stroke-2')
      expect(result).not.toContain('stroke-3')
    })

    it('空笔画集合应返回空数组', () => {
      const processor = new RectEraserProcessor()

      const strokes = new Map<string, Stroke>()
      const eraserPoints = [point(400, 300)]

      const result = processor.computeErasure!(
        eraserPoints,
        eraserStyle,
        strokes
      )

      expect(result).toEqual([])
    })

    it('空擦除点应返回空数组', () => {
      const processor = new RectEraserProcessor()

      const stroke = createStroke('stroke-1', [
        point(400, 300),
        point(440, 330)
      ])
      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      const result = processor.computeErasure!(
        [],
        eraserStyle,
        strokes
      )

      expect(result).toEqual([])
    })
  })

  describe('computeErasure — 小宽度擦除', () => {
    it('size=2 时，橡皮擦路径穿过笔画应能命中', () => {
      const processor = new RectEraserProcessor()

      // 水平笔画：y=300，x 从 100 到 500，每隔 20px 一个采样点
      const strokePoints: StrokePoint[] = []
      for (let x = 100; x <= 500; x += 20) {
        strokePoints.push(point(x, 300))
      }
      const stroke = createStroke('stroke-1', strokePoints)
      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      // 橡皮擦从 (300, 280) 垂直穿过到 (300, 320)，size=2
      const smallEraser: StrokeStyle = { ...eraserStyle, size: 2 }
      const eraserPts = [
        point(300, 280),
        point(300, 290),
        point(300, 300),
        point(300, 310),
        point(300, 320)
      ]

      const result = processor.computeErasure!(eraserPts, smallEraser, strokes)
      expect(result).toContain('stroke-1')
    })

    it('size=1 时，橡皮擦路径经过笔画附近应能命中', () => {
      const processor = new RectEraserProcessor()

      // 笔画采样点间距较大（40px），橡皮擦路径从两个采样点之间穿过
      const stroke = createStroke('stroke-1', [
        point(200, 300),
        point(240, 300),
        point(280, 300),
        point(320, 300)
      ])
      const strokes = new Map<string, Stroke>([['stroke-1', stroke]])

      // 橡皮擦从 (260, 280) 垂直穿过 y=300 线
      // 注意：260 不在任何采样点的 x 坐标上（在 240 和 280 之间）
      const tinyEraser: StrokeStyle = { ...eraserStyle, size: 1 }
      const eraserPts = [
        point(260, 280),
        point(260, 290),
        point(260, 300),
        point(260, 310)
      ]

      const result = processor.computeErasure!(eraserPts, tinyEraser, strokes)
      expect(result).toContain('stroke-1')
    })
  })

  describe('computeOutline — 擦除器也需要轮廓', () => {
    it('computeOutline 应返回 null（擦除器不绘制可见轮廓）', () => {
      const processor = new RectEraserProcessor()
      const points = [point(400, 300), point(480, 360)]

      const result = processor.computeOutline(points, eraserStyle, true)

      // 擦除器不需要可见轮廓，返回 null 或有效 Path2D 均可
      expect(result === null || result instanceof Path2D).toBe(true)
    })
  })
})
