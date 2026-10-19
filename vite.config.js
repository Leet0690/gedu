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
        manifest: {
          name: appName,
          short_name: shortName,
          description: `Portail de gestion académique — ${institutionName}`,
          theme_color: '#236247',
          background_color: '#f5fbf7',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'fr',
          icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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
