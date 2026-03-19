import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Particles from "@tsparticles/vue3"
import { loadSlim } from "@tsparticles/slim"
const app = createApp(App)
app.use(Particles, {
  init: async engine => {
    await loadSlim(engine); 
  },
})
app.mount('#app')
