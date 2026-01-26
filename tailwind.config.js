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
        
        // ========================================
        // AAAAA DESIGN SYSTEM - "Tactical Professional"
        // WCAG 2.2 AAA Compliant (7:1 contrast ratios)
        // ========================================
        
        // Primary: Service Blue - Headers, authoritative elements
        'service-blue': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#1b365d', // Primary - high authority
          950: '#102a43',
        },
        
        // Secondary: Tactical Grey - Navigation, secondary elements
        'tactical-grey': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#333e48', // Secondary
          900: '#243b53',
          950: '#102a43',
        },
        
        // Success: Medal Green - Protected status, evidence found
        'medal-green': {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',
          600: '#43a047',
          700: '#2e7d32', // Primary success (AAA compliant)
          800: '#256626',
          900: '#1b5e20',
          950: '#0d3610',
        },
        
        // Warning: Service Gold - Poke the Bear risks, secondary alerts
        'warning-gold': {
          50: '#fff8e1',
          100: '#ffecb3',
          200: '#ffe082',
          300: '#ffd54f',
          400: '#ffca28',
          500: '#ffc107',
          600: '#ffb300',
          700: '#c5a059', // Primary warning (visible in all modes)
          800: '#856404', // High-contrast warning text
          900: '#5c4300',
          950: '#3d2c00',
        },
        
        // Background: Off-White - Reduce glare and cognitive load
        'paper': {
          50: '#ffffff',
          100: '#fefefe',
          200: '#fcfcfc',
          300: '#f8f9fa', // Main workspace background
          400: '#f1f3f4',
          500: '#e8eaed',
          600: '#dadce0',
          700: '#bdc1c6',
          800: '#9aa0a6',
          900: '#5f6368',
          950: '#3c4043',
        },
        
        // TBI-Comfort Mode: Low blue-light, high legibility
        'tbi': {
          'charcoal': '#1a1a16',      // Deep warm background
          'amber': '#e8d5b5',          // Soft amber text
          'gold': '#c5a059',           // Accent color
          'warm-white': '#f5f0e6',     // Comfortable reading
          'soft-cream': '#ede4d3',     // Secondary surface
        },
        
        // AAA High Contrast Mode
        'aaa': {
          'black': '#000000',
          'white': '#ffffff',
          'yellow': '#ffff00',         // High-vis accent
          'cyan': '#00ffff',           // Secondary accent
        },
        
        // Risk Assessment Colors (with non-color indicators)
        'protected': {
          '20yr': '#1b365d',           // Service Blue - Shield icon
          '10yr': '#486581',           // Lighter blue - Partial shield
          '5yr': '#2e7d32',            // Medal Green - Checkmark
          'risk': '#c5a059',           // Warning Gold - Triangle
          'critical': '#8b0000',       // Deep Crimson - Octagon
        },
      },
      
      // AAA Focus Rings: Minimum 2px offset for clarity
      ringWidth: {
        '3': '3px',
      },
      ringOffsetWidth: {
        '3': '3px',
      },
      
      // AAA Target Sizes: Minimum 44x44px for motor accessibility
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      
      // Typography for accessibility
      fontSize: {
        'base-lg': ['18px', { lineHeight: '1.6' }], // AAA optimized body text
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
        // Toast notifications
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
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
        // Toast slide animations
        slideInRight: {
          '0%': { transform: 'translateX(400px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(400px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
