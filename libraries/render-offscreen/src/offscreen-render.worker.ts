// libraries/render-offscreen/src/offscreen-render.worker.ts
// Worker 侧 OffscreenCanvas 渲染器
// 运行在 Web Worker 内部，接收主线程指令，计算轮廓并在 OffscreenCanvas 上绘制

import type {
  StrokeProcessorInterface,
  StrokePoint,
  StrokeStyle,
  Camera
} from '@inker/types'

import { EraserTrail, geometryToPath2D } from '@inker/core'
import { WorkerBridgeWorker } from '@inker/render-protocol'
import type { RenderCommand } from '@inker/render-protocol'

// FileReaderSync 是 Worker 专属 API，TypeScript 标准 DOM lib 未包含其类型声明
declare class FileReaderSync {
  readAsDataURL(blob: Blob): string
}

/** 获取设备像素比（Worker 环境兼容） */
function getDevicePixelRatio(): number {
  return (self as unknown as { devicePixelRatio?: number }).devicePixelRatio ?? 1
}

/**
 * Worker 侧 OffscreenCanvas 渲染器启动入口
 *
 * 使用方式：在 Worker 入口文件中导入并调用此函数，传入 StrokeProcessor 实例。
 * 主线程通过 postMessage 发送 `{ cmd: 'init', renderCanvas, liveCanvas, width, height }`
 * 完成初始化后，后续指令通过 WorkerBridge 协议处理。
 *
 * @param strokeProcessor 笔画处理器（负责将采样点转换为轮廓几何）
 */
export function startRenderWorker(strokeProcessor: StrokeProcessorInterface): void {
  const bridge = new WorkerBridgeWorker()

  let liveCanvas: OffscreenCanvas | null = null
  let renderCanvas: OffscreenCanvas | null = null
  let liveCtx: OffscreenCanvasRenderingContext2D | null = null
  let renderCtx: OffscreenCanvasRenderingContext2D | null = null
  let camera: Camera = { x: 0, y: 0, zoom: 1 }
  let containerWidth = 0
  let containerHeight = 0
  let eraserTrail: EraserTrail | null = null

  // 处理初始化消息（带 Transferable OffscreenCanvas）
  self.onmessage = (e: MessageEvent) => {
    if (e.data.cmd === 'init') {
      renderCanvas = e.data.renderCanvas as OffscreenCanvas
      liveCanvas = e.data.liveCanvas as OffscreenCanvas
      containerWidth = e.data.width
      containerHeight = e.data.height
      renderCtx = renderCanvas.getContext('2d')!
      liveCtx = liveCanvas.getContext('2d')!
      // 初始化完成，切换到 bridge 的消息处理
      bridge.onMessage(handleCommand)
    }
  }

  /** 应用 camera 变换到 canvas context */
  function applyCamera(ctx: OffscreenCanvasRenderingContext2D): void {
    const dpr = getDevicePixelRatio()
    ctx.setTransform(
      dpr * camera.zoom, 0,
      0, dpr * camera.zoom,
      -camera.x * dpr * camera.zoom,
      -camera.y * dpr * camera.zoom
    )
  }

  /** 清除 canvas 内容（重置变换后清除整个区域） */
  function clearContext(ctx: OffscreenCanvasRenderingContext2D): void {
    const dpr = getDevicePixelRatio()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerWidth, containerHeight)
  }

  /** 在 canvas 上绘制轮廓路径 */
  function drawPath(
    ctx: OffscreenCanvasRenderingContext2D,
    path: Path2D,
    style: StrokeStyle
  ): void {
    ctx.save()
    applyCamera(ctx)
    ctx.globalAlpha = style.opacity
    ctx.fillStyle = style.color
    ctx.fill(path)
    ctx.restore()
  }

  /** 计算笔画轮廓并绘制 */
  function computeAndDraw(
    ctx: OffscreenCanvasRenderingContext2D,
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): void {
    const outline = strokeProcessor.computeOutline(points, style, complete)
    if (outline) drawPath(ctx, geometryToPath2D(outline), style)
  }

  /** 处理渲染指令 */
  function handleCommand(cmd: RenderCommand): void {
    switch (cmd.cmd) {
      case 'init':
        // init 通过 self.onmessage 处理，不会进入此分支
        break

      case 'drawLive':
        if (!liveCtx) break
        clearContext(liveCtx)
        computeAndDraw(liveCtx, cmd.points, cmd.style, false)
        break

      case 'drawLiveStrokes':
        // 批量绘制所有活跃笔画（多点触控场景）
        if (!liveCtx) break
        clearContext(liveCtx)
        for (const stroke of cmd.strokes) {
          computeAndDraw(liveCtx, stroke.points, stroke.style, false)
        }
        break

      case 'commit':
        if (!renderCtx) break
        computeAndDraw(renderCtx, cmd.points, cmd.style, true)
        break

      case 'clearLive':
        if (liveCtx) clearContext(liveCtx)
        break

      case 'redrawAll':
        if (!renderCtx) break
        clearContext(renderCtx)
        for (const stroke of cmd.strokes) {
          computeAndDraw(renderCtx, stroke.points, stroke.style, true)
        }
        break

      case 'clearAll':
        if (liveCtx) clearContext(liveCtx)
        if (renderCtx) clearContext(renderCtx)
        break

      case 'setCamera':
        camera = cmd.camera
        break

      case 'resize': {
        containerWidth = cmd.width
        containerHeight = cmd.height
        const dpr = getDevicePixelRatio()
        if (liveCanvas) {
          liveCanvas.width = cmd.width * dpr
          liveCanvas.height = cmd.height * dpr
        }
        if (renderCanvas) {
          renderCanvas.width = cmd.width * dpr
          renderCanvas.height = cmd.height * dpr
        }
        break
      }

      case 'startEraserTrail':
        if (eraserTrail) eraserTrail.stop()
        eraserTrail = new EraserTrail({ baseSize: cmd.baseSize })
        eraserTrail.start(outlines => {
          if (!liveCtx) return
          clearContext(liveCtx)
          if (outlines.length === 0) return
          liveCtx.save()
          applyCamera(liveCtx)
          liveCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'
          liveCtx.globalAlpha = 1
          for (const outline of outlines) liveCtx.fill(outline)
          liveCtx.restore()
        })
        break

      case 'addEraserPoint':
        eraserTrail?.addPoint(cmd.point)
        break

      case 'endEraserTrail':
        eraserTrail?.endTrail()
        break

      case 'stopEraserTrail':
        if (eraserTrail) {
          eraserTrail.stop()
          eraserTrail = null
        }
        break

      case 'flush':
        // 到达这里时所有先前指令已按序执行完毕
        bridge.respond({ cmd: 'flushed', id: cmd.id })
        break

      case 'export':
        if (!renderCanvas) {
          bridge.respond({
            cmd: 'exported',
            id: cmd.id,
            blob: new Blob([], { type: `image/${cmd.format}` })
          })
          break
        }
        {
          const mimeType = cmd.format === 'jpeg' ? 'image/jpeg' : 'image/png'
          renderCanvas.convertToBlob({ type: mimeType, quality: cmd.quality })
            .then(blob => {
              bridge.respond({ cmd: 'exported', id: cmd.id, blob })
            })
            .catch(() => {
              bridge.respond({ cmd: 'exported', id: cmd.id, blob: new Blob([], { type: mimeType }) })
            })
        }
        break

      case 'toDataURL':
        if (!renderCanvas) {
          bridge.respond({ cmd: 'dataURL', id: cmd.id, url: '' })
          break
        }
        // OffscreenCanvas 没有 toDataURL，通过 convertToBlob + FileReader 实现
        renderCanvas.convertToBlob({ type: 'image/png' })
          .then(blob => {
            const reader = new FileReaderSync()
            const url = reader.readAsDataURL(blob)
            bridge.respond({ cmd: 'dataURL', id: cmd.id, url })
          })
          .catch(() => {
            bridge.respond({ cmd: 'dataURL', id: cmd.id, url: '' })
          })
        break
    }
  }
}
