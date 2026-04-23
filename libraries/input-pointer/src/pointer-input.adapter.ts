import type { InputAdapterInterface, StrokeInputReceiver, PointerType, RawPoint } from '@inker/types'
import { generateUid } from '@inker/util'
import { PointExtractor } from './point-extractor.service'

/**
 * Pointer Events 输入适配器
 * 将浏览器 PointerEvent 转换为 StrokeInputReceiver 方法调用
 * pointerId → strokeId 映射在适配器内部维护，不泄漏到内核
 */
export class PointerInputAdapter implements InputAdapterInterface {
  /** 绑定的 DOM 元素 */
  private element: HTMLElement | null = null
  /** 绑定前的原始 touchAction 值 */
  private originalTouchAction: string = ''
  /** 坐标提取器 */
  private readonly extractor = new PointExtractor()
  /** 允许的指针类型，null 表示允许所有 */
  private allowedTypes: PointerType[] | null = null
  /** 当前活跃的指针 ID → strokeId 映射 */
  private pointerToStroke: Map<number, string> = new Map()
  /** 绑定的内核 */
  private kernel: StrokeInputReceiver | null = null

  /** 事件处理器引用（用于移除监听） */
  private readonly handlePointerDown = (e: PointerEvent) => this.onPointerDown(e)
  private readonly handlePointerMove = (e: PointerEvent) => this.onPointerMove(e)
  private readonly handlePointerUp = (e: PointerEvent) => this.onPointerUp(e)
  private readonly handlePointerCancel = (e: PointerEvent) => this.onPointerCancel(e)

  /**
   * 绑定内核，建立输入→内核通道
   */
  bindKernel(kernel: StrokeInputReceiver): void {
    this.kernel = kernel
  }

  /**
   * 绑定到 DOM 元素，开始监听指针事件
   */
  attach(element: HTMLElement): void {
    this.element = element
    // 禁止浏览器默认手势（滚动、缩放），防止数位板/触屏事件被拦截
    this.originalTouchAction = element.style.touchAction
    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', this.handlePointerDown)
    element.addEventListener('pointermove', this.handlePointerMove)
    element.addEventListener('pointerup', this.handlePointerUp)
    element.addEventListener('pointercancel', this.handlePointerCancel)
  }

  /**
   * 解绑 DOM 元素，停止监听
   */
  detach(): void {
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.handlePointerDown)
      this.element.removeEventListener('pointermove', this.handlePointerMove)
      this.element.removeEventListener('pointerup', this.handlePointerUp)
      this.element.removeEventListener('pointercancel', this.handlePointerCancel)
      // 恢复原始 touchAction 值
      this.element.style.touchAction = this.originalTouchAction
      this.element = null
    }
    this.pointerToStroke.clear()
  }

  /**
   * 设置允许的指针类型
   */
  setAllowedPointerTypes(types: PointerType[]): void {
    this.allowedTypes = types
  }

  /**
   * 销毁适配器，释放所有资源
   */
  dispose(): void {
    this.detach()
    this.kernel = null
  }

  /** 检查指针类型是否被允许 */
  private isPointerTypeAllowed(pointerType: string): boolean {
    if (this.allowedTypes === null) return true
    return this.allowedTypes.includes(pointerType as PointerType)
  }

  /** 获取容器偏移量 */
  private getOffset(): { left: number; top: number } {
    if (!this.element) return { left: 0, top: 0 }
    const rect = this.element.getBoundingClientRect()
    return { left: rect.left, top: rect.top }
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.isPointerTypeAllowed(e.pointerType)) return
    if (!this.kernel) return
    // 阻止浏览器默认行为（如文本选择、手势导航）
    e.preventDefault()

    const point = this.extractor.extract(e, this.getOffset())
    if (!point) return

    const rawPoint: RawPoint = { x: point.x, y: point.y, pressure: point.pressure }
    const strokeId = generateUid()
    this.pointerToStroke.set(e.pointerId, strokeId)

    this.kernel.startStroke(strokeId, rawPoint, Date.now())
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    const point = this.extractor.extract(e, this.getOffset())
    if (!point) return

    const rawPoint: RawPoint = { x: point.x, y: point.y, pressure: point.pressure }
    this.kernel.addStrokePoint(strokeId, rawPoint, Date.now())
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    this.kernel.endStroke(strokeId, Date.now())
    this.pointerToStroke.delete(e.pointerId)
  }

  private onPointerCancel(e: PointerEvent): void {
    if (!this.kernel) return
    const strokeId = this.pointerToStroke.get(e.pointerId)
    if (!strokeId) return

    // cancel 转换为 endStroke，cancel 语义不泄漏到内核
    this.kernel.endStroke(strokeId, Date.now())
    this.pointerToStroke.delete(e.pointerId)
  }
}
