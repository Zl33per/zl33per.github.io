<template>
  <div class="sports-wrapper relative min-h-screen w-full overflow-hidden bg-[#F8FAFC]">
    
    <Tetris 
      :base="30"
      squareColor="#A7F3D0"
      :opacity="0.4"
      class="absolute inset-0 z-0" 
    />

    <nav class="fixed top-0 w-full z-50 border-b border-gray-200 bg-white/60 backdrop-blur-lg">
      <div class="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
        <h1 class="text-xl font-bold tracking-tighter text-gray-800 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-sm bg-[#6DE4C6] rotate-45"></span>
          SPORTS <span class="text-[#6DE4C6]">HUB</span>
        </h1>
        <button 
          @click="$router.push('/')" 
          class="px-4 py-1.5 text-xs font-bold rounded-full border border-gray-200 text-gray-600 hover:border-[#6DE4C6] hover:text-[#6DE4C6] transition-all"
        >
          返回首页
        </button>
      </div>
    </nav>

    <main class="relative z-10 pt-32 pb-20 px-6 max-w-6xl mx-auto">
      <header class="mb-12">
        <h2 class="text-4xl font-black text-gray-900 tracking-tight italic">
          READY <span class="text-[#6DE4C6]">TO PLAY?</span>
        </h2>
        <p class="text-gray-400 text-sm mt-2 tracking-widest uppercase">Tactics & Records</p>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div 
          @click="goToFrisbee" 
          class="group cursor-pointer rounded-2xl bg-white/80 border border-white backdrop-blur-sm p-6 shadow-sm hover:shadow-xl hover:shadow-[#6DE4C6]/10 transition-all duration-300 hover:-translate-y-1"
        >
          <div class="mb-4 text-3xl">🥏</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2 group-hover:text-[#6DE4C6] transition-colors">
            飞盘战术模拟器
          </h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4">
            轻量化战术编排面板，支持动态演示与分叉逻辑。
          </p>
          <div class="text-[#6DE4C6] text-xs font-bold flex items-center gap-1">
            OPEN SIMULATOR <span>→</span>
          </div>
        </div>

        <div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 flex items-center justify-center p-6 opacity-50">
          <p class="text-gray-400 font-bold text-xs tracking-tighter uppercase text-center">
            Upcoming Project<br/>Sports Plan
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import Tetris from '@/components/ui/tetris/Tetris.vue' 
import { useRouter } from 'vue-router'

const router = useRouter()

const goToFrisbee = () => {
  window.location.href = '/frisbee_sim/index.html';
};
</script>