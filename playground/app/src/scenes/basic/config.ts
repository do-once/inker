import type { SceneConfig } from '../../types'

export const basicScene: SceneConfig = {
  name: '基础使用',
  path: '/basic',
  component: () => import('./BasicScene.vue'),
  tools: ['pen', 'marker', 'pencil', 'eraser'],
  panels: ['style', 'brush', 'zoom', 'playback']
}
