// libraries/render-protocol/src/worker-bridge.ts
import type { RenderCommand, RequestCommand, RenderResponse } from './types'

/**
 * 主线程侧 Bridge
 * 向 Worker 发送渲染指令，管理 request-response 回调
 */
export class WorkerBridgeHost {
  private nextId = 1
  private pending = new Map<number, {
    resolve: (resp: RenderResponse) => void
    reject: (err: Error) => void
  }>()
  private worker: Worker

  constructor(worker: Worker) {
    this.worker = worker
    this.worker.onmessage = (e: MessageEvent<RenderResponse>) => {
      const resp = e.data
      if ('id' in resp) {
        const entry = this.pending.get(resp.id)
        if (entry) {
          this.pending.delete(resp.id)
          entry.resolve(resp)
        }
      }
    }
    this.worker.onerror = (e: ErrorEvent) => {
      const error = new Error(`Worker error: ${e.message}`)
      for (const entry of this.pending.values()) {
        entry.reject(error)
      }
      this.pending.clear()
    }
  }

  /** fire-and-forget 发送指令 */
  send(cmd: RenderCommand): void {
    this.worker.postMessage(cmd)
  }

  /** request-response 发送指令（自动分配 id） */
  request(cmd: RequestCommand): Promise<RenderResponse> {
    const id = this.nextId++
    const tagged = { ...cmd, id }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage(tagged)
    })
  }

  /** 销毁 Bridge，终止 Worker */
  dispose(): void {
    this.worker.terminate()
    for (const entry of this.pending.values()) {
      entry.reject(new Error('WorkerBridge disposed'))
    }
    this.pending.clear()
  }
}

/**
 * Worker 侧 Bridge
 * 接收主线程指令并分发给处理器
 */
export class WorkerBridgeWorker {
  /** 注册指令处理器 */
  onMessage(handler: (cmd: RenderCommand) => void): void {
    self.onmessage = (e: MessageEvent<RenderCommand>) => {
      handler(e.data)
    }
  }

  /** 发送响应到主线程 */
  respond(resp: RenderResponse): void {
    self.postMessage(resp)
  }
}
