import type { Point, Camera } from '@inker/types'

/**
 * Camera 感知坐标系统
 * 管理视口变换，提供屏幕坐标与世界坐标的互转
 * 支持 resize/zoom/pan 统一为 camera 状态变化
 */
export class CoordinateSystem {
  private _camera: Camera = { x: 0, y: 0, zoom: 1 }
  private _documentWidth: number
  private _documentHeight: number
  private _containerWidth: number
  private _containerHeight: number

  /**
   * @param containerWidth 容器 CSS 宽度（像素），必须大于 0
   * @param containerHeight 容器 CSS 高度（像素），必须大于 0
   * @param documentWidth 文档逻辑宽度（像素），默认等于容器宽度
   * @param documentHeight 文档逻辑高度（像素），默认等于容器高度
   * @throws 宽度或高度为 0 或负数时抛出错误
   */
  constructor(
    containerWidth: number,
    containerHeight: number,
    documentWidth?: number,
    documentHeight?: number
  ) {
    if (containerWidth <= 0 || containerHeight <= 0) {
      throw new Error(`容器尺寸必须大于 0：width=${containerWidth}, height=${containerHeight}`)
    }
    this._containerWidth = containerWidth
    this._containerHeight = containerHeight
    this._documentWidth = documentWidth ?? containerWidth
    this._documentHeight = documentHeight ?? containerHeight

    // 初始 camera：auto-fit 居中
    this._camera = this.computeFitCamera()
  }

  /** 当前 Camera 状态 */
  get camera(): Camera {
    return this._camera
  }

  /** 设置 Camera 状态 */
  setCamera(camera: Camera): void {
    this._camera = camera
  }

  /** 文档逻辑宽度（像素） */
  get documentWidth(): number {
    return this._documentWidth
  }

  /** 文档逻辑高度（像素） */
  get documentHeight(): number {
    return this._documentHeight
  }

  /** 容器 CSS 宽度（像素） */
  get containerWidth(): number {
    return this._containerWidth
  }

  /** 容器 CSS 高度（像素） */
  get containerHeight(): number {
    return this._containerHeight
  }

  /**
   * 屏幕坐标 → 世界坐标
   * worldX = screenX / zoom + camera.x
   */
  screenToWorld(screenPoint: Point): Point {
    return {
      x: screenPoint.x / this._camera.zoom + this._camera.x,
      y: screenPoint.y / this._camera.zoom + this._camera.y
    }
  }

  /**
   * 世界坐标 → 屏幕坐标
   * screenX = (worldX - camera.x) * zoom
   */
  worldToScreen(worldPoint: Point): Point {
    return {
      x: (worldPoint.x - this._camera.x) * this._camera.zoom,
      y: (worldPoint.y - this._camera.y) * this._camera.zoom
    }
  }

  /**
   * 更新容器尺寸
   */
  resizeContainer(width: number, height: number): void {
    this._containerWidth = width
    this._containerHeight = height
  }

  /**
   * 计算让文档居中显示的 camera
   * zoom = min(containerW / docW, containerH / docH)
   * 居中偏移
   */
  computeFitCamera(): Camera {
    const zoom = Math.min(
      this._containerWidth / this._documentWidth,
      this._containerHeight / this._documentHeight
    )
    // 居中：让文档在容器正中间
    const x = -(this._containerWidth / zoom - this._documentWidth) / 2
    const y = -(this._containerHeight / zoom - this._documentHeight) / 2
    return { x, y, zoom }
  }

  /**
   * 世界坐标 → 归一化坐标（供序列化/导出使用）
   * 基于 documentSize
   */
  toNormalized(worldPoint: Point): Point {
    return {
      x: worldPoint.x / this._documentWidth,
      y: worldPoint.y / this._documentHeight
    }
  }

  /**
   * 归一化坐标 → 世界坐标（供反序列化/导入使用）
   * 基于 documentSize
   */
  fromNormalized(normalizedPoint: Point): Point {
    return {
      x: normalizedPoint.x * this._documentWidth,
      y: normalizedPoint.y * this._documentHeight
    }
  }
}
