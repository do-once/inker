import type { Vec2 } from './types'

/**
 * 向量取反。
 * @internal
 */
export function neg(A: Vec2): Vec2 {
  return [-A[0], -A[1]]
}

/**
 * 向量加法。
 * @internal
 */
export function add(A: Vec2, B: Vec2): Vec2 {
  return [A[0] + B[0], A[1] + B[1]]
}

/**
 * 向量加法（无分配，写入已有输出向量）。
 * @internal
 */
export function addInto(out: Vec2, A: Vec2, B: Vec2): Vec2 {
  out[0] = A[0] + B[0]
  out[1] = A[1] + B[1]
  return out
}

/**
 * 向量减法。
 * @internal
 */
export function sub(A: Vec2, B: Vec2): Vec2 {
  return [A[0] - B[0], A[1] - B[1]]
}

/**
 * 向量减法（无分配，写入已有输出向量）。
 * @internal
 */
export function subInto(out: Vec2, A: Vec2, B: Vec2): Vec2 {
  out[0] = A[0] - B[0]
  out[1] = A[1] - B[1]
  return out
}

/**
 * 向量标量乘法。
 * @internal
 */
export function mul(A: Vec2, n: number): Vec2 {
  return [A[0] * n, A[1] * n]
}

/**
 * 向量标量乘法（无分配，写入已有输出向量）。
 * @internal
 */
export function mulInto(out: Vec2, A: Vec2, n: number): Vec2 {
  out[0] = A[0] * n
  out[1] = A[1] * n
  return out
}

/**
 * 向量标量除法。
 * @internal
 */
export function div(A: Vec2, n: number): Vec2 {
  return [A[0] / n, A[1] / n]
}

/**
 * 向量垂直旋转（法向量）。
 * @internal
 */
export function per(A: Vec2): Vec2 {
  return [A[1], -A[0] || 0]
}

/**
 * 向量垂直旋转（无分配，写入已有输出向量）。
 * @internal
 */
export function perInto(out: Vec2, A: Vec2): Vec2 {
  const temp = A[0]
  out[0] = A[1]
  out[1] = -temp
  return out
}

/**
 * 向量点积。
 * @internal
 */
export function dpr(A: Vec2, B: Vec2): number {
  return A[0] * B[0] + A[1] * B[1]
}

/**
 * 判断两个向量是否相等。
 * @internal
 */
export function isEqual(A: Vec2, B: Vec2): boolean {
  return A[0] === B[0] && A[1] === B[1]
}

/**
 * 向量长度。
 * @internal
 */
export function len(A: Vec2): number {
  return Math.hypot(A[0], A[1])
}

/**
 * 向量长度的平方。
 * @internal
 */
export function len2(A: Vec2): number {
  return A[0] * A[0] + A[1] * A[1]
}

/**
 * 两点距离的平方（内联以提升性能）。
 * @internal
 */
export function dist2(A: Vec2, B: Vec2): number {
  const dx = A[0] - B[0]
  const dy = A[1] - B[1]
  return dx * dx + dy * dy
}

/**
 * 获取单位向量。
 * @internal
 */
export function uni(A: Vec2): Vec2 {
  return div(A, len(A))
}

/**
 * 两点之间的距离。
 * @internal
 */
export function dist(A: Vec2, B: Vec2): number {
  return Math.hypot(A[1] - B[1], A[0] - B[0])
}

/**
 * 两个向量的中点。
 * @internal
 */
export function med(A: Vec2, B: Vec2): Vec2 {
  return mul(add(A, B), 0.5)
}

/**
 * 将向量 A 绕向量 C 旋转 r 弧度。
 * @internal
 */
export function rotAround(A: Vec2, C: Vec2, r: number): Vec2 {
  const s = Math.sin(r)
  const c = Math.cos(r)

  const px = A[0] - C[0]
  const py = A[1] - C[1]

  const nx = px * c - py * s
  const ny = px * s + py * c

  return [nx + C[0], ny + C[1]]
}

/**
 * 将向量 A 绕向量 C 旋转 r 弧度（无分配，写入已有输出向量）。
 * @internal
 */
export function rotAroundInto(out: Vec2, A: Vec2, C: Vec2, r: number): Vec2 {
  const s = Math.sin(r)
  const c = Math.cos(r)

  const px = A[0] - C[0]
  const py = A[1] - C[1]

  const nx = px * c - py * s
  const ny = px * s + py * c

  out[0] = nx + C[0]
  out[1] = ny + C[1]
  return out
}

/**
 * 向量线性插值：A 到 B，参数为标量 t。
 * @internal
 */
export function lrp(A: Vec2, B: Vec2, t: number): Vec2 {
  return add(A, mul(sub(B, A), t))
}

/**
 * 向量线性插值（无分配，写入已有输出向量）。
 * @internal
 */
export function lrpInto(out: Vec2, A: Vec2, B: Vec2, t: number): Vec2 {
  const dx = B[0] - A[0]
  const dy = B[1] - A[1]
  out[0] = A[0] + dx * t
  out[1] = A[1] + dy * t
  return out
}

/**
 * 将点 A 沿方向 B 投影标量 c 的距离。
 * @internal
 */
export function prj(A: Vec2, B: Vec2, c: number): Vec2 {
  return add(A, mul(B, c))
}

/**
 * 将点 A 沿方向 B 投影标量 c 的距离（无分配，写入已有输出向量）。
 * @internal
 */
export function prjInto(out: Vec2, A: Vec2, B: Vec2, c: number): Vec2 {
  out[0] = A[0] + B[0] * c
  out[1] = A[1] + B[1] * c
  return out
}
