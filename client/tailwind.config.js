/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}', // src dizinindeki tüm dosyalar
    './components/**/*.{js,ts,jsx,tsx}', // components dizini
    './pages/**/*.{js,ts,jsx,tsx}', // pages dizini
  ],
  theme: {
    extend: {
      colors: {
        'neon-green': '#00ff99',
        'neon-purple': '#ff00ff',
        'neon-blue': '#00ccff',
        'neon-cyan': '#00ffff',
        'neon-red': '#ff3333',
        'neon-yellow': '#ffff33',
        'dark-gray': '#333',
      },
    },
  },
  plugins: [],
};