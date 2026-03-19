<script setup>
import myLogo from './assets/logo.svg'
// 1. 引入 Iconify 组件
import { Icon } from '@iconify/vue'

const navLinks = [
  { name: '首页', path: '/' },
  { name: '训练日志', path: '/training' },
  { name: '关于我', path: '/about' }
]
</script>

<template>
  <header class="navbar">
    <div class="logo-area">
      <img :src="myLogo" alt="Logo" class="logo-img" />
      <span class="site-name">My Digital Garden</span>
    </div>
    
    <nav class="nav-links">
      <a v-for="link in navLinks" :key="link.path" :href="link.path">
        {{ link.name }}
      </a>

      <div class="social-icons">
        <a href="https://github.com/你的用户名" target="_blank">
          <Icon icon="mdi:github" class="nav-icon" />
        </a>
        <a href="#">
          <Icon icon="lucide:code-2" class="nav-icon" />
        </a>
      </div>
    </nav>
  </header>

  <main class="content-wrapper">
    <div class="hero-section">
      <h1 class="title">你好，我是 [你的名字]</h1>
      <p class="subtitle">正在构建中的个人站...</p>
    </div>
  </main>
</template>

<style scoped>
/* 在原有样式基础上补充 */
.nav-links {
  display: flex;
  align-items: center; /* 确保文字和图标对齐 */
  gap: 25px;
}

.social-icons {
  display: flex;
  gap: 15px;
  border-left: 1px solid #ddd; /* 加个小分隔线 */
  padding-left: 15px;
}

.nav-icon {
  font-size: 24px; /* 控制图标大小 */
  color: #333;
  transition: color 0.3s;
  vertical-align: middle;
}

.nav-icon:hover {
  color: #42b883; /* 悬停变 Vue 绿 */
}

.hero-section {
  margin-top: 100px;
}

.title {
  font-size: 3rem;
  margin-bottom: 10px;
}
</style>