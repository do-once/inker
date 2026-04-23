// libraries/render-protocol/src/types.ts
import type { StrokePoint, StrokeStyle, StrokeData, Camera } from '@inker/types'

/** 初始化指令（attach 阶段通过 postMessage + Transferable 发送，不经过 WorkerBridge） */
export interface InitCommand {
  cmd: 'init'
  renderCanvas: OffscreenCanvas
  liveCanvas: OffscreenCanvas
  width: number
  height: number
}

/** 需要 request-response 的指令（调用方无需提供 id，由 WorkerBridge 自动分配） */
export type RequestCommand =
  | { cmd: 'flush' }
  | { cmd: 'export'; format: 'png' | 'jpeg'; quality?: number }
  | { cmd: 'toDataURL' }

/** 主线程 → Worker 的渲染指令（完整类型，含 id） */
export type RenderCommand =
  | InitCommand
  | { cmd: 'drawLive'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'drawLiveStrokes'; strokes: StrokeData[] }
  | { cmd: 'commit'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'clearLive' }
  | { cmd: 'redrawAll'; strokes: StrokeData[] }
  | { cmd: 'clearAll' }
  | { cmd: 'setCamera'; camera: Camera }
  | { cmd: 'resize'; width: number; height: number }
  | { cmd: 'startEraserTrail'; baseSize: number }
  | { cmd: 'addEraserPoint'; point: { x: number; y: number } }
  | { cmd: 'endEraserTrail' }
  | { cmd: 'stopEraserTrail' }
  | (RequestCommand & { id: number })

/** Worker → 主线程的响应 */
export type RenderResponse =
  | { cmd: 'flushed'; id: number }
  | { cmd: 'exported'; id: number; blob: Blob }
  | { cmd: 'dataURL'; id: number; url: string }
