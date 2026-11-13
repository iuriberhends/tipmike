/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

// ── Paleta TipMike (nov/2026), tirada da logo ───────────────────────
// marca  = turquesa/menta do domo (500 é o destaque principal)
// neutro = cinzas puxados para o petróleo do fundo da logo
const marca = {
  50: '#f0fefb', 100: '#dffdf7', 200: '#b9f7ec', 300: '#8ff1e2', 400: '#56e2ce',
  500: '#2bcdb9', 600: '#189e8e', 700: '#0d847a', 800: '#0d6b64', 900: '#0b5650', 950: '#052f2c',
};
const neutro = {
  50: '#f3f9f8', 100: '#e6f1f0', 200: '#cfdfde', 300: '#b3c8c7', 400: '#8ba5a6',
  500: '#6c8689', 600: '#4c666a', 700: '#344b50', 800: '#1c2f34', 900: '#0f1c21', 950: '#070e11',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marca,
        neutro,
        // Mesmos valores das variáveis --mike-* do index.css, mas como cor
        // nomeada: aceita opacidade (bg-mike-accent/15), coisa que
        // bg-[--mike-accent]/15 não faz (o Tailwind não gera a classe).
        mike: {
          bg: '#060b0f',
          'bg-2': '#04080b',
          card: '#0b1519',
          'card-2': '#0f1c21',
          'card-hover': '#132429',
          border: '#1a2c31',
          fg: '#eef8f6',
          'fg-soft': '#b5c9c8',
          'fg-muted': '#6c8689',
          accent: '#2bcdb9',
          'accent-2': '#0d847a',
          menta: '#8ff1e2',
        },
        // As telas foram escritas com emerald-* (destaque), slate-* (cinzas)
        // e cyan-* (informação). Em vez de reescrever milhares de classes,
        // essas três escalas passam a apontar para a paleta da marca.
        emerald: marca,
        slate: neutro,
        cyan: colors.sky, // azul-céu: distinto do turquesa da marca
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Unbounded Variable"', 'Unbounded', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
