import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Debe coincidir con el nombre del repositorio en GitHub Pages.
  base: "/roca-eterna-musica/",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,webmanifest,ico}"],
        globIgnores: [
          "**/icons/logo modo claro.png",
          "**/icons/logo modo oscuro.png",
          "**/icons/cropped-LOGO-IBRE-5-1.png",
          "**/icons/icon-192.*",
          "**/icons/icon-512.*"
        ]
      },
      includeAssets: [
        "favicon.png",
        "icons/roca-eterna-logo-light.png",
        "icons/roca-eterna-logo-dark.png",
        "icons/pwa-192.png",
        "icons/pwa-512.png",
        "icons/pwa-maskable-192.png",
        "icons/pwa-maskable-512.png",
        "icons/apple-touch-icon.png"
      ],
      manifest: {
        name: "Roca Eterna Música",
        short_name: "Roca Eterna",
        description: "Organización del ministerio de música de Roca Eterna",
        lang: "es-MX",
        theme_color: "#111111",
        background_color: "#f6f5f2",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/roca-eterna-musica/",
        scope: "/roca-eterna-musica/",
        icons: [
          {
            src: "/roca-eterna-musica/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/roca-eterna-musica/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/roca-eterna-musica/icons/pwa-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/roca-eterna-musica/icons/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          icons: ["lucide-react"],
          charts: ["recharts"],
          pdf: ["@react-pdf/renderer", "pdf-lib"]
        }
      }
    }
  }
});
