import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../App.vue'),
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
  history: createWebHistory(),
  routes
})

export default router