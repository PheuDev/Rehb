/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Pile système : identique à celle déclarée dans Chart.js (aucune
      // requête externe, pas de FOUT) — évite de déclarer une police « Inter »
      // qui n'est jamais chargée.
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        forest: {
          50: "#f0f7f2",
          100: "#dcece0",
          200: "#b9d9c4",
          300: "#8bc09f",
          400: "#5ba177",
          500: "#3c825a",
          600: "#2d6846",
          700: "#25533a",
          800: "#204331",
          900: "#1b382a",
        },
      },
    },
  },
  plugins: [],
};
