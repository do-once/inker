import { createRouter, createWebHashHistory } from 'vue-router'
import { scenes } from './scenes'

const routes = [
  { path: '/', redirect: scenes[0].path },
  ...scenes.map(scene => ({
    path: scene.path,
    name: scene.path.slice(1),
    component: scene.component
  }))
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
