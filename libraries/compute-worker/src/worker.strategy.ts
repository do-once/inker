import { ComputeStrategy } from '@inker/core'
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle, OutlineGeometry } from '@inker/types'

/**
 * Worker 计算策略
 * Worker 可用时使用 Web Worker 执行计算
 * 不可用时自动降级到主线程同步策略
 *
 * @deprecated 计算职责已内聚到各 RenderAdapter 内部。
 * 请使用 @inker/render-offscreen（Worker 内计算+渲染）替代。
 */
export class WorkerStrategy extends ComputeStrategy {
  /** Worker 是否可用 */
  readonly isWorkerAvailable: boolean

  constructor() {
    super()
    // 检测 Worker 可用性
    // happy-dom 环境下 Worker 未定义，自动降级
    let available = false
    try {
      available =
        typeof Worker !== 'undefined' &&
        typeof window !== 'undefined' &&
        'Worker' in window
    } catch {
      available = false
    }
    this.isWorkerAvailable = available
  }

  /**
   * 计算笔画轮廓
   * Worker 可用时委托给 Worker 线程，否则降级到主线程同步调用
   */
  computeOutline(
    processor: StrokeProcessorInterface,
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): Promise<OutlineGeometry | null> {
    if (this.isWorkerAvailable) {
      // TODO: 未来实现真正的 Worker 通信
      // 当前降级到主线程
    }
    // 降级：直接在主线程调用 processor
    return Promise.resolve(
      processor.computeOutline(points, style, complete)
    )
  }

  /** 释放资源，幂等操作 */
  dispose(): void {
    // 如有 Worker 实例，终止它
    // 当前无需清理
  }
}
