import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGithubActions ? '/qwen-webgpu-poc/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
