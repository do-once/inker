import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const transformCase = (str: string) => {
  const kebabCaseName = str.replace('@', '').replace('/', '-')

  const PascalName = kebabCaseName
    .split('-')
    .map((v) => v[0].toUpperCase() + v.slice(1))
    .join('')

  return { PascalName, kebabCaseName }
}

/**
 * 库包共享 Vite 构建配置
 * ESM + UMD，不压缩，输出 sourcemap
 */
export function createLibConfig(entry: string, pkgName: string) {
  const { PascalName } = transformCase(pkgName)

  return defineConfig({
    build: {
      lib: {
        entry: resolve(entry),
        name: PascalName,
        // formats: ['es', 'umd'],
        formats: ['umd'],
        fileName: (format) => `${PascalName}.${format}.js`,
        cssFileName: PascalName
      },
      sourcemap: false,
      minify: false,
      rollupOptions: {
        // external: [/^@inker\//]
      }
    }
  })
}
