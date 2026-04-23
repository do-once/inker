import type { DocumentSnapshot } from './document-snapshot.types'
import type { Stroke } from './stroke.types'
import type { StrokeStyle } from './stroke-style.types'

/**
 * 事件映射表
 * 定义所有可订阅的事件及其数据类型
 */
export interface EventMap {
  /** 文档内容变更（笔画增删、undo/redo） */
  'document:changed': DocumentSnapshot
  /** 笔画开始 */
  'stroke:start': { strokeId: string; style: StrokeStyle }
  /** 笔画结束 */
  'stroke:end': { stroke: Stroke }
  /** 笔画删除 */
  'stroke:delete': { strokeIds: readonly string[] }
  /** 画布清空 */
  'stroke:clear': void
  /** 主题变更 */
  'theme:changed': void
  /** 笔样式变更 */
  'penStyle:changed': StrokeStyle
}
