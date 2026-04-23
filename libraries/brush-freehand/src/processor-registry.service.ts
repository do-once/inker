import type { StrokeProcessorInterface, StrokeType } from '@inker/types'

/**
 * 笔画处理器注册表
 * 维护笔画类型到处理器实例的映射关系
 * 支持动态注册、覆盖和查询
 */
export class ProcessorRegistry {
  /** 类型 -> 处理器的映射 */
  private readonly processors = new Map<StrokeType, StrokeProcessorInterface>()

  /**
   * 注册处理器
   * 遍历处理器声明的 supportedTypes，为每种类型建立映射
   * 重复注册同一类型会覆盖先前的处理器
   */
  register(processor: StrokeProcessorInterface): void {
    for (const type of processor.supportedTypes) {
      this.processors.set(type, processor)
    }
  }

  /**
   * 获取指定类型的处理器
   * 未注册的类型会抛出错误
   */
  get(type: StrokeType): StrokeProcessorInterface {
    const processor = this.processors.get(type)
    if (!processor) {
      throw new Error(`未注册的笔画类型: ${type}`)
    }
    return processor
  }

  /**
   * 检查指定类型是否已注册处理器
   */
  has(type: StrokeType): boolean {
    return this.processors.has(type)
  }
}
