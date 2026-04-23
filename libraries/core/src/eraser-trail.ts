/** 轨迹点（世界坐标 + 时间戳） */
export interface TrailPoint {
  x: number
  y: number
  timestamp: number
}

/** EraserTrail 配置 */
export interface EraserTrailOptions {
  /** 基础轨迹宽度（世界坐标 px） */
  baseSize: number
  /** 时间衰减窗口（ms），默认 200 */
  decayTime?: number
  /** 长度衰减窗口（点数），默认 10 */
  decayLength?: number
}

/** easeOut 缓动：t 从 0→1 映射为减速曲线 */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * 橡皮擦轨迹管理器
 * 管理轨迹点、衰减计算、轮廓生成和 rAF 动画
 */
export class EraserTrail {
  readonly baseSize: number
  private readonly decayTime: number
  private readonly decayLength: number
  private points: TrailPoint[] = []
  /** 结束的轨迹点集合（继续衰减直到消失） */
  private pastPointSets: TrailPoint[][] = []
  /** rAF ID */
  private rafId: number | null = null
  /** 帧回调 */
  private onFrameCallback: ((outlines: Path2D[]) => void) | null = null

  constructor(options: EraserTrailOptions) {
    this.baseSize = options.baseSize
    this.decayTime = options.decayTime ?? 200
    this.decayLength = options.decayLength ?? 10
  }

  /** 添加一个轨迹点 */
  addPoint(p: { x: number; y: number }): void {
    this.points.push({
      x: p.x,
      y: p.y,
      timestamp: performance.now()
    })
  }

  /** 计算所有点的衰减后宽度 */
  getDecayedSizes(): number[] {
    const now = performance.now()

    return this.points.map((pt, i) => {
      // 时间衰减：距当前时间越远，衰减越大
      const t = Math.max(0, 1 - (now - pt.timestamp) / this.decayTime)

      // 长度衰减：距离尾部（index 0）越近越小
      const distFromTail = i
      const l = Math.min(distFromTail, this.decayLength) / this.decayLength

      // 取较小值，经过 easeOut 缓动
      const factor = Math.min(easeOut(l), easeOut(t))

      return this.baseSize * factor
    })
  }

  /** 获取当前点数 */
  get length(): number {
    return this.points.length
  }

  /** 清除所有点 */
  clear(): void {
    this.points = []
  }

  /** 获取原始点数据（供外部读取坐标） */
  getPoints(): readonly TrailPoint[] {
    return this.points
  }

  /** 生成闭合轮廓 Path2D */
  computeOutline(): Path2D | null {
    const sizes = this.getDecayedSizes()

    // 过滤出 size > 0 的连续点段
    const validIndices: number[] = []
    for (let i = 0; i < this.points.length; i++) {
      if (sizes[i] > 0) validIndices.push(i)
    }

    if (validIndices.length < 2) return null

    // 计算每个有效点的法线方向，两侧偏移生成轮廓
    const leftPoints: { x: number; y: number }[] = []
    const rightPoints: { x: number; y: number }[] = []

    for (let idx = 0; idx < validIndices.length; idx++) {
      const i = validIndices[idx]
      const pt = this.points[i]
      const halfSize = sizes[i] / 2

      // 计算行进方向
      let dx: number, dy: number
      if (idx === 0) {
        const next = this.points[validIndices[1]]
        dx = next.x - pt.x
        dy = next.y - pt.y
      } else if (idx === validIndices.length - 1) {
        const prev = this.points[validIndices[idx - 1]]
        dx = pt.x - prev.x
        dy = pt.y - prev.y
      } else {
        const prev = this.points[validIndices[idx - 1]]
        const next = this.points[validIndices[idx + 1]]
        dx = next.x - prev.x
        dy = next.y - prev.y
      }

      // 归一化
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len === 0) continue

      const nx = -dy / len // 法线方向
      const ny = dx / len

      leftPoints.push({ x: pt.x + nx * halfSize, y: pt.y + ny * halfSize })
      rightPoints.push({ x: pt.x - nx * halfSize, y: pt.y - ny * halfSize })
    }

    if (leftPoints.length < 2) return null

    // 构建闭合路径：left 正序 → right 逆序
    const path = new Path2D()
    path.moveTo(leftPoints[0].x, leftPoints[0].y)
    for (let i = 1; i < leftPoints.length; i++) {
      path.lineTo(leftPoints[i].x, leftPoints[i].y)
    }
    for (let i = rightPoints.length - 1; i >= 0; i--) {
      path.lineTo(rightPoints[i].x, rightPoints[i].y)
    }
    path.closePath()

    return path
  }

  /** 获取 pastTrails 数量 */
  get pastTrailCount(): number {
    return this.pastPointSets.length
  }

  /** 动画是否正在运行 */
  get isRunning(): boolean {
    return this.rafId !== null
  }

  /** 启动 rAF 动画循环 */
  start(onFrame: (outlines: Path2D[]) => void): void {
    this.onFrameCallback = onFrame
    this.scheduleFrame()
  }

  /** 停止 rAF 动画循环 */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.onFrameCallback = null
    this.points = []
    this.pastPointSets = []
  }

  /** 结束当前轨迹，让其继续衰减 */
  endTrail(): void {
    if (this.points.length >= 2) {
      this.pastPointSets.push([...this.points])
    }
    this.points = []
  }

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame(() => this.frame())
  }

  private frame(): void {
    const outlines: Path2D[] = []

    // 渲染当前活跃轨迹
    const currentOutline = this.computeOutline()
    if (currentOutline) outlines.push(currentOutline)

    // 渲染 pastTrails
    this.pastPointSets = this.pastPointSets.filter(pts => {
      const outline = this.computeOutlineForPoints(pts)
      if (outline) {
        outlines.push(outline)
        return true
      }
      return false // 已完全衰减，移除
    })

    if (this.onFrameCallback) {
      this.onFrameCallback(outlines)
    }

    // 如果有活跃轨迹或 pastTrails 还在衰减，继续调度
    if (this.points.length > 0 || this.pastPointSets.length > 0) {
      this.scheduleFrame()
    } else {
      this.rafId = null
    }
  }

  /** 为任意点集合计算轮廓（复用衰减逻辑） */
  private computeOutlineForPoints(pts: TrailPoint[]): Path2D | null {
    const savedPoints = this.points
    this.points = pts
    const outline = this.computeOutline()
    this.points = savedPoints
    return outline
  }
}
