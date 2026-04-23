/**
 * 颜色解析工具
 */

/** RGBA 颜色值 */
export interface RGBAColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

/**
 * 将颜色字符串解析为 RGBA 对象
 * 支持格式：#RGB、#RRGGBB、#RRGGBBAA、rgb()、rgba()
 * @param color 颜色字符串
 * @returns RGBA 颜色对象
 * @throws 无法解析的颜色格式
 */
export function colorToRGB(color: string): RGBAColor {
  if (!color) {
    throw new Error(`无法解析颜色值：'${color}'`)
  }

  const trimmed = color.trim()

  // 尝试解析 hex 格式
  if (trimmed.startsWith('#')) {
    return parseHex(trimmed)
  }

  // 尝试解析 rgba() 格式
  if (trimmed.startsWith('rgba(')) {
    return parseRGBA(trimmed)
  }

  // 尝试解析 rgb() 格式
  if (trimmed.startsWith('rgb(')) {
    return parseRGB(trimmed)
  }

  throw new Error(`无法解析颜色值：'${color}'`)
}

/**
 * 解析 hex 颜色
 * 支持 #RGB、#RRGGBB、#RRGGBBAA
 */
function parseHex(hex: string): RGBAColor {
  const value = hex.slice(1).toLowerCase()

  if (value.length === 3) {
    // #RGB → #RRGGBB
    const r = parseInt(value[0] + value[0], 16)
    const g = parseInt(value[1] + value[1], 16)
    const b = parseInt(value[2] + value[2], 16)
    validateRGBRange(r, g, b)
    return { r, g, b, a: 1 }
  }

  if (value.length === 6) {
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    validateRGBRange(r, g, b)
    return { r, g, b, a: 1 }
  }

  if (value.length === 8) {
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    const a = parseInt(value.slice(6, 8), 16) / 255
    validateRGBRange(r, g, b)
    return { r, g, b, a }
  }

  throw new Error(`无法解析 hex 颜色值：'${hex}'`)
}

/**
 * 解析 rgb() 格式
 */
function parseRGB(str: string): RGBAColor {
  const match = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!match) {
    throw new Error(`无法解析 rgb 颜色值：'${str}'`)
  }

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  validateRGBRange(r, g, b)
  return { r, g, b, a: 1 }
}

/**
 * 解析 rgba() 格式
 */
function parseRGBA(str: string): RGBAColor {
  const match = str.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/
  )
  if (!match) {
    throw new Error(`无法解析 rgba 颜色值：'${str}'`)
  }

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  const a = parseFloat(match[4])
  validateRGBRange(r, g, b)
  return { r, g, b, a }
}

/**
 * 验证 RGB 值范围
 */
function validateRGBRange(r: number, g: number, b: number): void {
  if (
    isNaN(r) || isNaN(g) || isNaN(b) ||
    r < 0 || r > 255 ||
    g < 0 || g > 255 ||
    b < 0 || b > 255
  ) {
    throw new Error(`RGB 值超出范围：r=${r}, g=${g}, b=${b}`)
  }
}
