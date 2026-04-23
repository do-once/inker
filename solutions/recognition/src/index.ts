// @inker/recognition — 为手写识别算法准备笔画数据

// 类型
export type { StrokeGroup, ExportFormat, ExportFormatOptions, RecognitionTarget } from './types'

// 纯工具函数
export { groupByTime } from './group-by-time'

// 格式
export { SimpleJsonFormat } from './formats/simple-json.format'
export type { SimpleJsonResult } from './formats/simple-json.format'

// Helper
export { RecognitionHelper } from './recognition-helper'
