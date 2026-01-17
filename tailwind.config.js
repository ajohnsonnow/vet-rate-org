module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'va-blue': 'var(--va-blue, #2d5016)',
        'va-gold': 'var(--va-gold, #88b04b)',
      },
    },
  },
  plugins: [],
}
