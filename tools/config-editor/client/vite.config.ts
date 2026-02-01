// tools/config-editor/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './vite/api-plugin';

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
    host: true,  // IPv4 + IPv6 모두 바인딩
    open: true
  },
  preview: {
    port: 5173,
    host: true,
    open: true
  }
});
