/**
 * 唯一标识符生成工具
 */

/**
 * 生成唯一 ID
 * 基于时间戳和随机数，保证唯一性
 * @returns 固定长度的唯一字符串
 */
export function generateUid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  const counter = (globalCounter++).toString(36).padStart(4, '0')
  return `${timestamp}-${counter}-${random}`
}

/** 全局计数器，保证即使同一毫秒内也不重复 */
let globalCounter = 0
