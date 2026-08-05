/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      // 代理到后端，开发期同源，refresh cookie 顺畅通。
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // AI HTML 生成（DeepSeek V4 Pro）耗时不稳定，复杂报告 2-5 分钟，偶发更久；
        // server 端 290s 主动超时兜底，这里给到 10min 避免 proxy 先于 server 返回裸 500。
        proxyTimeout: 600000,
        timeout: 600000,
      },
      // 本地上传文件静态托管（STORAGE_DRIVER=local 时）。
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 核心（react + react-dom + react-router）
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          // 图表库（recharts 很大，单独拆出来）
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) {
            return 'chart-vendor';
          }
          // 状态管理
          if (id.includes('node_modules/zustand')) {
            return 'state-vendor';
          }
          // 组件渲染层：report 组件（KpiBoard, CampaignAnalysis, SwotMatrix 等较重）
          if (id.includes('/editor/components/report/') || id.includes('/editor/components/WorksComponents')) {
            return 'report-components';
          }
          // 达人组件（CreatorComponents 40KB 源码）
          if (id.includes('/editor/components/CreatorComponents')) {
            return 'creator-components';
          }
          // 公司/品牌组件
          if (id.includes('/editor/components/CompanyComponents')) {
            return 'company-components';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
  },
});
