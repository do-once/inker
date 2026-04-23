import type { SceneConfig } from '../../types'

export const recognitionScene: SceneConfig = {
  name: '识别调试',
  path: '/recognition',
  component: () => import('./RecognitionScene.vue'),
  tools: ['pen', 'pencil', 'eraser'],
  panels: ['style', 'brush', 'recognition']
}
