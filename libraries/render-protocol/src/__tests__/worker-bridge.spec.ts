// libraries/render-protocol/src/__tests__/worker-bridge.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { WorkerBridgeHost } from '../worker-bridge'

// Mock Worker
function createMockWorker() {
  let messageHandler: ((e: MessageEvent) => void) | null = null
  let errorHandler: ((e: ErrorEvent) => void) | null = null
  const posted: unknown[] = []
  return {
    postMessage: vi.fn((data: unknown) => { posted.push(data) }),
    set onmessage(fn: ((e: MessageEvent) => void) | null) { messageHandler = fn },
    get onmessage() { return messageHandler },
    set onerror(fn: ((e: ErrorEvent) => void) | null) { errorHandler = fn },
    get onerror() { return errorHandler },
    terminate: vi.fn(),
    simulateResponse(data: unknown) {
      messageHandler?.({ data } as MessageEvent)
    },
    simulateError(message: string) {
      errorHandler?.({ message } as ErrorEvent)
    },
    posted
  }
}

describe('WorkerBridgeHost', () => {
  it('send 发送指令不等待回复', () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    bridge.send({ cmd: 'clearLive' })
    expect(worker.postMessage).toHaveBeenCalledWith({ cmd: 'clearLive' })
  })

  it('send 传递完整指令数据', () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const style = { type: 'pen' as const, color: '#000', size: 2, opacity: 1 }
    const points = [{ x: 10, y: 20, t: 0, p: 0.5 }]
    bridge.send({ cmd: 'drawLive', points, style })
    expect(worker.postMessage).toHaveBeenCalledWith({ cmd: 'drawLive', points, style })
  })

  it('request 自动分配 id 并等待回复', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'flush' })
    // 获取发送的指令中的 id
    const sentCmd = worker.posted[0] as { cmd: string; id: number }
    expect(sentCmd.id).toBeDefined()
    expect(sentCmd.id).toBeGreaterThan(0)
    // 模拟 Worker 回复
    worker.simulateResponse({ cmd: 'flushed', id: sentCmd.id })
    const resp = await promise
    expect(resp).toEqual({ cmd: 'flushed', id: sentCmd.id })
  })

  it('request 支持 export 指令', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'export', format: 'png' })
    const sentCmd = worker.posted[0] as { cmd: string; id: number }
    const blob = new Blob(['test'], { type: 'image/png' })
    worker.simulateResponse({ cmd: 'exported', id: sentCmd.id, blob })
    const resp = await promise
    expect(resp.cmd).toBe('exported')
    if (resp.cmd === 'exported') expect(resp.blob).toBe(blob)
  })

  it('多个并发 request 各自独立回复', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const p1 = bridge.request({ cmd: 'flush' })
    const p2 = bridge.request({ cmd: 'flush' })
    const sent1 = worker.posted[0] as { id: number }
    const sent2 = worker.posted[1] as { id: number }
    // 倒序回复
    worker.simulateResponse({ cmd: 'flushed', id: sent2.id })
    worker.simulateResponse({ cmd: 'flushed', id: sent1.id })
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.cmd).toBe('flushed')
    expect(r2.cmd).toBe('flushed')
  })

  it('dispose 终止 Worker 并 reject 所有 pending', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'flush' })
    bridge.dispose()
    await expect(promise).rejects.toThrow('WorkerBridge disposed')
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('Worker 错误时 reject 所有 pending', async () => {
    const worker = createMockWorker()
    const bridge = new WorkerBridgeHost(worker as unknown as Worker)
    const promise = bridge.request({ cmd: 'flush' })
    worker.simulateError('Worker crashed')
    await expect(promise).rejects.toThrow('Worker error: Worker crashed')
  })
})
