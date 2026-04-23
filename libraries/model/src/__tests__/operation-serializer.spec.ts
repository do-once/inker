import { describe, it, expect } from 'vitest'
import { operationsToJSON, jsonToOperations } from '../operation-serializer.service'
import type { Operation } from '@inker/types'

describe('operationsToJSON', () => {
  it('应将操作序列序列化为 JSON 字符串', () => {
    const ops: Operation[] = [
      {
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      },
      {
        type: 'stroke:addPoint',
        strokeId: 's1',
        point: { x: 30, y: 40, p: 0.6, t: 150 }
      },
      {
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 200
      }
    ]

    const json = operationsToJSON(ops, { width: 800, height: 600 })

    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.0')
    expect(parsed.documentSize).toEqual({ width: 800, height: 600 })
    expect(parsed.operations).toHaveLength(3)
    expect(parsed.operations[0].type).toBe('stroke:start')
  })
})

describe('jsonToOperations', () => {
  it('应将 JSON 反序列化为操作序列', () => {
    const original: Operation[] = [
      {
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen', color: '#ff0000', size: 3, opacity: 0.8 },
        point: { x: 50, y: 60, p: 0.7, t: 500 },
        timestamp: 500
      },
      {
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 600
      }
    ]

    const json = operationsToJSON(original, { width: 1920, height: 1080 })
    const result = jsonToOperations(json)

    expect(result.operations).toEqual(original)
    expect(result.documentSize).toEqual({ width: 1920, height: 1080 })
  })

  it('无效 JSON 应抛出错误', () => {
    expect(() => jsonToOperations('invalid')).toThrow()
  })

  it('版本不匹配应抛出错误', () => {
    const json = JSON.stringify({ version: '99.0', documentSize: { width: 100, height: 100 }, operations: [] })
    expect(() => jsonToOperations(json)).toThrow()
  })
})
