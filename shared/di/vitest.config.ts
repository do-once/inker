import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '@inker/web-rig/library/vitest.config.base'

export default mergeConfig(baseConfig, defineConfig({
  test: {
    root: '.'
  }
}))
