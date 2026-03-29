import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import Markdown from 'unplugin-vue-markdown/vite'

export default defineConfig({
  plugins: [
    vue({
      include: [/\.vue$/, /\.md$/], 
    }),
    Markdown({

    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})