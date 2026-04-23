import { defineConfig } from 'vitest/config'

/**
 * 共享测试配置
 * happy-dom 环境，globals: true，v8 coverage
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov']
    }
  }
})
