/**
 * happy-dom 不支持 Canvas API，提供最小 polyfill
 * 与 @inker/render-canvas 的 setup.ts 相同
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Path2D polyfill
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {
    constructor(_path?: string | Path2D) {
      // 空实现
    }
  }
}

// CanvasRenderingContext2D polyfill（用于 instanceof 检查）
if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
  (globalThis as any).CanvasRenderingContext2D = class CanvasRenderingContext2D {}
}

// 为 HTMLCanvasElement 补全 getContext 方法
const originalCreateElement = document.createElement.bind(document)
const canvasContextMap = new WeakMap<HTMLCanvasElement, any>()

// 创建模拟 2D context
function createMockContext2D(canvas: HTMLCanvasElement): any {
  const ctx = Object.create(CanvasRenderingContext2D.prototype)
  Object.defineProperty(ctx, 'canvas', { value: canvas, writable: false })
  ctx.strokeStyle = '#000000'
  ctx.fillStyle = '#000000'
  ctx.lineWidth = 1
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  ctx.globalAlpha = 1
  ctx.save = () => {}
  ctx.restore = () => {}
  ctx.stroke = () => {}
  ctx.fill = () => {}
  ctx.clearRect = () => {}
  ctx.fillRect = () => {}
  ctx.strokeRect = () => {}
  ctx.beginPath = () => {}
  ctx.closePath = () => {}
  ctx.moveTo = () => {}
  ctx.lineTo = () => {}
  ctx.arc = () => {}
  ctx.scale = () => {}
  ctx.translate = () => {}
  ctx.setTransform = () => {}
  ctx.resetTransform = () => {}
  return ctx
}

// 覆盖 document.createElement 以拦截 canvas 创建
document.createElement = function (tagName: string, options?: ElementCreationOptions) {
  const el = originalCreateElement(tagName, options)
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = el as HTMLCanvasElement
    const originalGetContext = canvas.getContext?.bind(canvas)
    canvas.getContext = function (contextId: string, ...args: any[]) {
      if (contextId === '2d') {
        if (!canvasContextMap.has(canvas)) {
          canvasContextMap.set(canvas, createMockContext2D(canvas))
        }
        return canvasContextMap.get(canvas)
      }
      return originalGetContext ? originalGetContext(contextId, ...args) : null
    } as any
    canvas.toDataURL = function () {
      return 'data:image/png;base64,mock'
    }
  }
  return el
} as typeof document.createElement
