import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'خطوة',
        short_name: 'خطوة',
        description: 'سجادة عند مكان الوضوء تقيس حرارة القدمين وتنبّه مبكرًا. أداة مراقبة، مو تشخيص.',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E4B5A',
        theme_color: '#0E4B5A',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // Legacy pages are separate sites on the same domain: never answer them with the app shell.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/sim\//, /^\/dev\//, /^\/story\//, /^\/legacy\//, /^\/js\//, /^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: true },
});
