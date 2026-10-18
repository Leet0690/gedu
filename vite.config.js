import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_INSTITUTION_APP_NAME || 'Gestion EFP';
  const shortName = env.VITE_INSTITUTION_SHORT_NAME || 'EFP';
  const institutionName = env.VITE_INSTITUTION_NAME || 'Établissement de Formation Professionnelle';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'logo.jpg', 'logo-ipfpp.png', 'pwa-192.png', 'pwa-512.png'],
        manifest: {
          name: appName,
          short_name: shortName,
          description: `Portail de gestion académique — ${institutionName}`,
          theme_color: '#023471',
          background_color: '#F5F7FA',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'fr',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff2}'],
          globIgnores: [
            '**/assets/html2canvas-*.js',
            '**/assets/jspdf*.js',
            '**/assets/pdfGenerator-*.js',
            '**/assets/purify.es-*.js',
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: true,
    },
    build: {
      chunkSizeWarningLimit: 600,
    },
  };
});
