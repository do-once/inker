/**
 * happy-dom 不支持 OffscreenCanvas / Canvas API，提供最小 polyfill
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Path2D polyfill
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {
    constructor(_path?: string | Path2D) {}
    moveTo(_x: number, _y: number) {}
    lineTo(_x: number, _y: number) {}
    closePath() {}
  }
}

// CanvasRenderingContext2D polyfill
if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
  (globalThis as any).CanvasRenderingContext2D = class CanvasRenderingContext2D {}
}

// HTMLCanvasElement 增强
const originalCreateElement = document.createElement.bind(document)
const canvasContextMap = new WeakMap<HTMLCanvasElement, any>()

function createMockContext2D(canvas: HTMLCanvasElement): any {
  const ctx = Object.create(CanvasRenderingContext2D.prototype)
  Object.defineProperty(ctx, 'canvas', { value: canvas, writable: false })
  ctx.fillStyle = '#000000'
  ctx.globalAlpha = 1
  ctx.save = () => {}
  ctx.restore = () => {}
  ctx.fill = () => {}
  ctx.clearRect = () => {}
  ctx.setTransform = () => {}
  ctx.moveTo = () => {}
  ctx.lineTo = () => {}
  ctx.closePath = () => {}
  return ctx
}

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
    // transferControlToOffscreen mock
    ;(canvas as any).transferControlToOffscreen = function () {
      return { width: canvas.width, height: canvas.height, getContext: () => createMockContext2D(canvas) }
    }
  }
  return el
} as typeof document.createElement
