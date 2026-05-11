/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        charcoal: "rgb(var(--color-charcoal) / <alpha-value>)",
        stonewash: "rgb(var(--color-stonewash) / <alpha-value>)",
        linen: "rgb(var(--color-linen) / <alpha-value>)",
        brass: "rgb(var(--color-brass) / <alpha-value>)",
        "blue-gray": "rgb(var(--color-blue-gray) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(17, 17, 17, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
