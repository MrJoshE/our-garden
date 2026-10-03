import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      // Registered from App.svelte, which shows the Update now banner
      injectRegister: false,
      manifest: {
        name: 'Garden Journal',
        short_name: 'Garden',
        description: 'Notes and photos of the plants in a garden, kept on this device.',
        lang: 'en-GB',
        display: 'standalone',
        background_color: '#f3f5f0',
        theme_color: '#f3f5f0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // The whole app, fonts and icons included. Nothing is fetched at runtime.
      workbox: { globPatterns: ['**/*.{html,js,css,woff2,svg,png}'] },
      includeManifestIcons: false
    })
  ],
  // Shown in Backup and settings
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['src/**/*.test.js'],
    setupFiles: ['src/test/setup.js'],
    restoreMocks: true,
    unstubGlobals: true
  }
});
