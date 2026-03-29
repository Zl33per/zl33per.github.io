<script setup>
import myLogo from '../assets/logo.png'
import { Icon } from '@iconify/vue'
import { ref, onMounted } from 'vue'
import FluidCursor from '../components/ui/fluid-cursor/FluidCursor.vue'
import FallingStarsBg from '../components/ui/bg-falling-stars/FallingStarsBg.vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateTo = (path) => {
  console.log("点击触发，接收到的路径是:", path); // 如果控制台没印出这行，说明点击事件没挂载成功
  if (path) {
    router.push(path);
  } else {
    console.error("错误：路径为空，无法跳转！"); // 如果印出这行，说明数据里的 path 没写对
  }
}

const page2Links = [
  { name: '学习', path: '/learning' },
  { name: '音乐', path: '/music' },
  { name: '随笔', path: '/essays' },
  { name: '运动', path: '/sports' }
]

const sectionCards = [
  {
    title: '学习',
    path: '/learning',
    icon: 'mdi:book-open-variant',
    desc: '学习笔记与技术探索',
    topPosts: [
      { title: '数据结构与算法' },
      { title: '计算机硬件' },
      { title: 'EECS498学习' }
    ]
  },
  {
    title: '音乐',
    path: '/music',
    icon: 'mdi:music',
    desc: '音乐学习与个性化歌单',
    topPosts: [
      { title: '练琴记录' },
      { title: '乐理学习笔记' }
    ]
  },
  {
    title: '随笔',
    path: '/essays',
    icon: 'mdi:pencil-outline',
    desc: '灵感片段与生活随感',
    topPosts: [
      { title: '书单' },
      { title: '练字一路楼' }
    ]
  },
  {
    title: '运动',
    path: '/sports',
    icon: 'mdi:run',
    desc: '健身与运动日志',
    topPosts: [
      { title: '飞盘战术模拟器' },
      { title: '运动计划' }
    ]
  }
]



const currentSection = ref(1)

//监听滚动事件
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  const windowHeight = window.innerHeight
  currentSection.value = Math.round(scrollTop / windowHeight) + 1
}

onMounted(() => {
  const container = document.querySelector('.snap-container')
  container.addEventListener('scroll', handleScroll)
})

const particlesOptions = {
  background: {
    color: { value: "transparent" } //透出渐变底色
  },
  fpsLimit: 120,
  interactivity: {
    events: {
      onHover: { enable: true, mode: "grab" }, //鼠标悬停时会有连线感
    },
    modes: {
      grab: { distance: 140, links: { opacity: 0.5 } }
    }
  },
  particles: {
    color: { value: "#ffffff" },
    links: {
      color: "#ffffff",
      distance: 150,
      enable: true,
      opacity: 0.2,
      width: 1
    },
    move: {
      enable: true,
      speed: 1, //漂浮速度
      direction: "none",
      random: true,
      straight: false,
      outModes: { default: "out" }
    },
    number: {
      density: { enable: true, area: 800 },
      value: 100 //数量
    },
    opacity: {
      value: { min: 0.3, max: 0.8 }, //透明度
      animation: { enable: true, speed: 1, sync: false }
    },
    size: {
      value: { min: 1, max: 3 }
    }
  },
  detectRetina: true
}
</script>

<template>
  <div class="home-root">
    <FluidCursor 
        :density-dissipation="5.0"   
        :velocity-dissipation="4.0"  
        :splat-radius="0.12"         
        :splat-force="3000" 
        :colorUpdateSpeed="5"
    />

    <div class="snap-container">
        <div class="side-dots">
        <div v-for="i in 3" :key="i" class="dot" :class="{ active: currentSection === i }"></div>
        </div>

        <section class="section section-1">
        <vue-particles
            id="tsparticles"
            :options="particlesOptions"
        />
        <div class="hero-box">
            <img :src="myLogo" alt="Logo" class="main-logo" />
            <h1 class="fade-in-text">DIGITAL GARDEN</h1>
        </div>
        <div class="scroll-indicator">Scroll Down</div>
        </section>

        <section class="section section-2">
        <FallingStarsBg 
            :color="'#FFF'" 
            :count="200" 
            class="absolute inset-0 z-0" 
        />
        <header class="navbar-v2">
            <div class="header-left">
            <img :src="myLogo" alt="Logo" class="nav-logo-v2" />
            <span class="site-name-v2">Zleeper</span>
            </div>
            <nav class="nav-links-v2">
            <a 
              v-for="link in page2Links" 
              :key="link.name" 
              @click.prevent="router.push(link.path)"
              class="cursor-pointer"
            >
              {{ link.name }}
            </a>
            </nav>
        </header>

        <div class="cards-container">
            <Card 
            v-for="card in sectionCards" 
            :key="card.title" 
            class="info-card-v3 group"
            >
            <CardHeader>
                <div class="flex items-center gap-3">
                <Icon :icon="card.icon" class="text-2xl text-[#00A3E0]" />
                <CardTitle class="text-xl font-bold">{{ card.title }}</CardTitle>
                </div>
                <CardDescription>{{ card.desc }}</CardDescription>
            </CardHeader>
            
            <CardContent class="flex-grow">
                <ul class="space-y-2 text-sm text-muted-foreground">
                <li v-for="post in card.topPosts" :key="post.title" @click="navigateTo(card.path)" class="hover:text-[#00A3E0] transition-colors cursor-pointer">
                    • {{ post.title }}
                </li>
                </ul>
            </CardContent>

            <CardFooter>
                <Button 
                variant="outline" 
                class="w-full group-hover:bg-[#00A3E0] group-hover:text-white transition-all border-[#00A3E0] text-[#00A3E0]"
                @click="navigateTo(card.path)"
                >
                进入板块
                </Button>
            </CardFooter>
            </Card>
        </div>
        </section>

        <section class="section section-3">
        <h2>To be continued</h2>
        </section>
    </div>
  </div>
</template>

<style scoped>
.fade-in-text {
  font-family: 'Montserrat', sans-serif;
  letter-spacing: 0.6em; 
  font-size: 3.5rem;
  font-weight: 500; 
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  animation: reveal 1.8s cubic-bezier(0.77, 0, 0.175, 1);
  white-space: nowrap;
}

.snap-container {
  height: 100vh;
  width: 100vw;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  background-color: #fff;
}
.snap-container::-webkit-scrollbar { display: none; }

.section {
  height: 100vh;
  width: 100%;
  scroll-snap-align: start;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.section-1 {
  background: linear-gradient(-45deg, #121F33, #3EE69F, #C585FF, #F9EB75);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  color: white;
}

#tsparticles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.hero-box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-2 {
  background-color: #000;
  color: white;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 0;
  overflow: hidden;
}

.absolute.inset-0 {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index:0;
}


.navbar-v2 {
  position: absolute;
  top: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 3rem;
  box-sizing: border-box;
  z-index: 100; 

  /*毛玻璃效果*/
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); 
  /* 微光边框 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.1); 
  /* 阴影悬浮 */
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.header-left { display: flex; align-items: center; gap: 15px; }
.nav-logo-v2 { height: 35px; }
.site-name-v2 {
  font-family: 'Montserrat', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: white;
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px rgba(66, 184, 131, 0.5); 
}

.nav-links-v2 {
  display: flex;
  gap: 3rem;
  align-items: center;
}

.nav-links-v2 a {
  font-family: 'Montserrat', sans-serif;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 1.1rem;
  font-weight: 550;
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
  position: relative;
}


.nav-links-v2 a::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: #00A3E0;
  transition: width 0.3s ease;
}

.nav-links-v2 a:hover {
  color: #00A3E0;
}

.nav-links-v2 a:hover::after {
  width: 100%;
}

.cards-container {
  position: relative;
  margin-top: 150px;
  width: 90%;
  display: flex;
  justify-content: center;
  gap: 30px;
  padding: 20px;
  z-index:10;
}

.info-card-v3 {
  width: 280px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
}

.info-card-v3:hover {
  transform: translateY(-12px) scale(1.02);
  background: #dbf4f6;
  box-shadow: 0 20px 40px rgba(37, 150, 190, 0.2); 
  border-color: #00A3E0;
}

.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.card-icon { font-size: 1.8rem; color: #00A3E0; }
.card-title { font-size: 1.4rem; font-weight: 700; margin: 0; }
.card-desc { font-size: 0.9rem; color: #666; margin-bottom: 20px; line-height: 1.4; }

.article-preview {
  list-style: none;
  padding: 0;
  margin: 0 0 25px 0;
  flex-grow: 1; 
}
.article-preview li { margin-bottom: 10px; font-size: 0.85rem; }
.article-preview a {
  text-decoration: none;
  color: #555;
  transition: color 0.3s;
}
.article-preview a:hover { color: #00A3E0; }

.card-btn {
  text-decoration: none;
  background-color: #333;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  transition: background-color 0.3s;
}
.card-btn:hover { background-color: #000; }
.section-3 { background-color: #ffffff; }

.side-dots {
  position: fixed;
  right: 30px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  background: rgba(128, 128, 128, 0.4);
  border-radius: 50%;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.dot.active {
  background: #87f2e6;
  height: 24px;
  border-radius: 10px;
}

.main-logo { height: 100px; margin-bottom: 20px; }
.fade-in-text {
  font-size: 3rem;
  letter-spacing: 0.3em;
  animation: reveal 1.5s ease-out;
}

@keyframes reveal {
  0% { opacity: 0; transform: translateY(20px); filter: blur(10px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.scroll-indicator {
  position: absolute; 
  bottom: 40px; 
  left: 50%;
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  opacity: 0.6;
  animation: bounce 2s infinite;
  pointer-events: auto; 
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
  40% { transform: translateX(-50%) translateY(-10px); }
}
.section-3 h2 {
  font-family: 'Montserrat', sans-serif;
  font-weight: 400; 
  letter-spacing: 0.8em; 
  color: rgba(0, 0, 0, 0.9);
  text-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
  text-transform: uppercase;
  font-size: 3rem;
}
</style>
<style>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
}
</style>