/**
 * happy-dom 不支持 Path2D，提供最小 polyfill
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {
    constructor(_path?: string | Path2D) {
      // 空实现，仅用于 instanceof 检查
    }
    moveTo(_x: number, _y: number): void {}
    lineTo(_x: number, _y: number): void {}
    closePath(): void {}
  }
}
