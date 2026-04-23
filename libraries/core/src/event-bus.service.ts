/**
 * 事件总线服务
 * 提供类型安全的发布/订阅机制
 */
export class EventBus {
  /** 事件监听器映射 */
  private listeners = new Map<string, Set<(data: unknown) => void>>()

  /**
   * 注册事件监听器
   * @param event 事件名
   * @param handler 处理函数
   * @returns 取消订阅函数
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)

    return () => {
      this.off(event, handler)
    }
  }

  /**
   * 移除事件监听器
   * @param event 事件名
   * @param handler 处理函数
   */
  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * 注册一次性事件监听器
   * 触发一次后自动移除
   * @param event 事件名
   * @param handler 处理函数
   */
  once(event: string, handler: (data: unknown) => void): void {
    const wrapper = (data: unknown) => {
      this.off(event, wrapper)
      handler(data)
    }
    this.on(event, wrapper)
  }

  /**
   * 触发事件
   * @param event 事件名
   * @param data 事件数据
   */
  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      // 复制一份避免迭代时修改（once 场景）
      for (const handler of [...handlers]) {
        handler(data)
      }
    }
  }

  /**
   * 清除所有监听器
   */
  dispose(): void {
    this.listeners.clear()
  }
}
