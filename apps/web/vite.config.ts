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
        manualChunks: {
          // React 核心（react + react-dom + react-router）
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 图表库（recharts 很大，单独拆出来）
          'chart-vendor': ['recharts'],
          // 状态管理
          'state-vendor': ['zustand'],
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
