import { describe, it, expect } from 'vitest'
import { generateUid } from '../uid.util'

describe('generateUid', () => {
  it('生成的 ID 是字符串类型', () => {
    const id = generateUid()
    expect(typeof id).toBe('string')
  })

  it('生成的 ID 长度合理（不为空）', () => {
    const id = generateUid()
    expect(id.length).toBeGreaterThan(0)
  })

  it('生成的 ID 只包含合法字符（字母数字和连字符）', () => {
    const id = generateUid()
    // 允许字母、数字、连字符、下划线
    expect(id).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('多次调用生成不同的 ID（唯一性）', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateUid())
    }
    // 100 次调用应该生成 100 个不同的 ID
    expect(ids.size).toBe(100)
  })

  it('并发生成的 ID 也保持唯一', () => {
    const ids = Array.from({ length: 1000 }, () => generateUid())
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(1000)
  })

  it('ID 长度一致', () => {
    const ids = Array.from({ length: 10 }, () => generateUid())
    const lengths = ids.map(id => id.length)
    // 所有 ID 长度应一致
    expect(new Set(lengths).size).toBe(1)
  })
})
