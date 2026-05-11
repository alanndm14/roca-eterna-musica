/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        charcoal: "#242424",
        stonewash: "#f6f5f2",
        linen: "#ede9df",
        brass: "#b6945f",
        "blue-gray": "#60717d"
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
