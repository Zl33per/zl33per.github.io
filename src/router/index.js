// 1. 引入 createWebHashHistory 而不是 createWebHistory
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/learning',
    name: 'Learning',
    component: () => import('../views/Learning.vue')
  },
  {
    path: '/essays',
    name: 'Essays',
    component: () => import('../views/Essays.vue')
  },
  {
    path: '/music',
    name: 'Music',
    component: () => import('../views/Music.vue')
  },
  {
    path: '/sports',
    name: 'Sports',
    component: () => import('../views/Sports.vue')
  },
]

const router = createRouter({
  // 2. 将 history 修改为 Hash 模式
  history: createWebHashHistory(),
  routes
})

export default router