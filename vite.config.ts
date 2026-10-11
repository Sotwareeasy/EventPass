import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], server: { proxy: {
    ...(env.N8N_CHAT_URL ? {'/api/eventpass/soporte': {
      target: new URL(env.N8N_CHAT_URL).origin,
      changeOrigin: true,
      rewrite: () => new URL(env.N8N_CHAT_URL).pathname,
      headers: { 'ngrok-skip-browser-warning': '1' },
    }} : {}),
    '/api/eventpass': {
      target: env.N8N_BASE_URL || 'http://127.0.0.1:5678',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api\/eventpass/, '/webhook/eventpass'),
      headers: { 'ngrok-skip-browser-warning': '1' },
    },
  } } };
});
