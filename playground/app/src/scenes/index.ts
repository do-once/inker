import type { SceneConfig } from '../types'
import { basicScene } from './basic/config'
import { recognitionScene } from './recognition/config'

export const scenes: SceneConfig[] = [
  basicScene,
  recognitionScene
]
