/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#f3f6fb', 100: '#e6ecf5', 200: '#c8d5e8', 300: '#9db3d3', 400: '#6b8bb8', 500: '#4a6b9c', 600: '#3a5580', 700: '#2f4468', 800: '#1f2f4d', 900: '#14203a', 950: '#0b1426' },
        gold: { 50: '#fbf7ec', 100: '#f5ecd0', 200: '#ecd9a0', 300: '#e0c070', 400: '#d4a94c', 500: '#c4912f', 600: '#a87623', 700: '#8a5d1f', 800: '#6f4a1f', 900: '#5a3c1d' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,20,38,.06), 0 4px 16px rgba(11,20,38,.06)',
        lift: '0 12px 32px rgba(11,20,38,.16)',
      },
      keyframes: { 'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } } },
      animation: { 'fade-up': 'fade-up .5s ease-out both' },
    },
  },
  plugins: [],
};
