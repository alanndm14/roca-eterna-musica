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
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest,pdf}"]
      },
      includeAssets: ["icons/logo modo claro.png", "icons/cropped-LOGO-IBRE-5-1.png"],
      manifest: {
        name: "Roca Eterna Música",
        short_name: "RE Música",
        description: "Organización del ministerio de música de Roca Eterna",
        theme_color: "#111111",
        background_color: "#f6f5f2",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icons/logo%20modo%20claro.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "icons/cropped-LOGO-IBRE-5-1.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
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
