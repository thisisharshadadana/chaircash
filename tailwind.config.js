export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f0fdf4", 500: "#16a34a", 600: "#15803d", 700: "#166534" },
        surface: "#fafaf7",
        darkSurface: "#0f1412"
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"Helvetica Neue"', "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)"
      }
    }
  },
  plugins: []
};
