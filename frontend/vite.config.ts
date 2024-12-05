import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const baseUrl = env.BASE_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/session': {
          target: baseUrl,
          changeOrigin: true,
        },
        '/health': {
          target: baseUrl,
          changeOrigin: true,
        },
        '/compact': {
          target: baseUrl,
          changeOrigin: true,
        },
        '/compacts': {
          target: baseUrl,
          changeOrigin: true,
        },
        '/balance': {
          target: baseUrl,
          changeOrigin: true,
        },
        '/balances': {
          target: baseUrl,
          changeOrigin: true,
        },
      },
    },
    define: {
      'process.env.BASE_URL': JSON.stringify(baseUrl),
    },
  };
});
