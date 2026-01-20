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
      screens: {
        'xs': '475px',
        // Mobile-first breakpoints (default sm:640, md:768, lg:1024, xl:1280)
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
}
