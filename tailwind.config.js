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
        // Tablet-specific breakpoints for iPad and similar devices
        'tablet': '768px',           // iPad portrait
        'tablet-lg': '1024px',       // iPad landscape / iPad Pro portrait
        'tablet-landscape': { 'raw': '(min-width: 768px) and (max-width: 1366px) and (orientation: landscape)' },
        'tablet-portrait': { 'raw': '(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)' },
        // Touch device detection
        'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
        'no-touch': { 'raw': '(hover: hover) and (pointer: fine)' },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      animation: {
        // Luna's fun entrance animations 🐱
        'luna-bounce-in': 'lunaBounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'luna-slide-up': 'lunaSlideUp 0.5s ease-out',
        'luna-pop-in': 'lunaPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'luna-swing-in': 'lunaSwingIn 0.6s ease-out',
        'luna-fade-zoom': 'lunaFadeZoom 0.5s ease-out',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        // Bouncy entrance like a cat pouncing
        lunaBounceIn: {
          '0%': { transform: 'translate(-50%, -50%) scale(0) rotate(-10deg)', opacity: '0' },
          '50%': { transform: 'translate(-50%, -50%) scale(1.1) rotate(5deg)', opacity: '1' },
          '70%': { transform: 'translate(-50%, -50%) scale(0.95) rotate(-3deg)' },
          '100%': { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)' },
        },
        // Slides up from below
        lunaSlideUp: {
          '0%': { transform: 'translate(-50%, 100%)', opacity: '0' },
          '100%': { transform: 'translate(-50%, -50%)', opacity: '1' },
        },
        // Pop/scale effect
        lunaPopIn: {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0' },
          '80%': { transform: 'translate(-50%, -50%) scale(1.05)', opacity: '1' },
          '100%': { transform: 'translate(-50%, -50%) scale(1)' },
        },
        // Swing in like a cat jumping
        lunaSwingIn: {
          '0%': { transform: 'translate(-50%, -50%) rotate(-15deg) scale(0.5)', opacity: '0' },
          '40%': { transform: 'translate(-50%, -50%) rotate(10deg) scale(1.1)', opacity: '1' },
          '60%': { transform: 'translate(-50%, -50%) rotate(-5deg) scale(0.98)' },
          '80%': { transform: 'translate(-50%, -50%) rotate(2deg) scale(1.02)' },
          '100%': { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)' },
        },
        // Fade + zoom combo
        lunaFadeZoom: {
          '0%': { transform: 'translate(-50%, -50%) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '1' },
        },
        // Wiggle for paw print
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        // Subtle pulse for Luna's photo
        pulseSubtle: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(168, 85, 247, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(168, 85, 247, 0)' },
        },
      },
    },
  },
  plugins: [],
}
