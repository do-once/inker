import type { Operation, Size } from '@inker/types'

/** 导出数据格式 */
interface ExportData {
  version: string
  documentSize: Size
  operations: Operation[]
}

const CURRENT_VERSION = '1.0'

/**
 * 将操作序列序列化为 JSON 字符串
 * 坐标使用绝对世界坐标，附带 documentSize 元数据
 */
export function operationsToJSON(
  operations: readonly Operation[],
  documentSize: Size
): string {
  const data: ExportData = {
    version: CURRENT_VERSION,
    documentSize,
    operations: operations as Operation[]
  }
  return JSON.stringify(data)
}

/**
 * 将 JSON 字符串反序列化为操作序列
 */
export function jsonToOperations(json: string): {
  operations: Operation[]
  documentSize: Size
} {
  const data = JSON.parse(json) as ExportData
  if (!data.version || !data.version.startsWith('1.')) {
    throw new Error(`不支持的版本: ${data.version}`)
  }
  return {
    operations: data.operations,
    documentSize: data.documentSize
  }
}
