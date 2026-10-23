import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // 第三方依赖单独成块：内容不变时可长期缓存，只更新业务代码
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
          if (id.includes('@cloudbase')) return 'cloudbase'
          if (id.includes('vue')) return 'vue'
        },
      },
    },
  },
})
