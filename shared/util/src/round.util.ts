/**
 * 数值精度处理工具
 */

/**
 * 四舍五入到指定小数位数
 * @param value 输入数值
 * @param precision 保留的小数位数（默认 0）
 * @returns 四舍五入后的数值
 */
export function round(value: number, precision: number = 0): number {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}
