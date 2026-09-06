import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "logo.svg", "data/deped-calendar.json"],
      manifest: {
        name: "GradeBoss",
        short_name: "GradeBoss",
        description:
          "The ultimate solution for the most demanding school tasks, from teachers to admins.",
        theme_color: "#6d5efc",
        background_color: "#0f1220",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Primary data lives in IndexedDB; localStorage retains SF1 class list
        // and is read once on first launch for migration.
        // Learner avatars are procedural SVG (no extra image assets to precache).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,xlsx,json}"],
        navigateFallback: "index.html",
        // Official ECR template is optional (`public/templates/ecr.xlsx`).
        // CacheFirst so Excel export still works offline after the first fetch.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/templates/"),
            handler: "CacheFirst",
            options: {
              cacheName: "gradeboss-ecr-templates",
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/data/"),
            handler: "CacheFirst",
            options: {
              cacheName: "gradeboss-official-data",
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        // Enables the service worker in `vite dev` so offline behavior can be
        // exercised without a separate production build.
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
