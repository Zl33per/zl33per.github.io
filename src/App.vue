<script setup>
</script>

<template>
  <div class="min-h-screen bg-background">
    <main>
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
html,body{
    margin:0;
    padding:0;
    min-height: 100%; 
    overflow-y: auto;
    overflow-x:hidden;
}
#app {
    width: 100%;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>