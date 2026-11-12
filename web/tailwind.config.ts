import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--kh-${name})`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          950: v('brand-950'),
          900: v('brand-900'),
          700: v('brand-700'),
          600: v('brand-600'),
          500: v('brand-500'),
          300: v('brand-300'),
          100: v('brand-100'),
          50: v('brand-50'),
          DEFAULT: v('brand-700'),
        },
        bg: v('bg'),
        surface: v('surface'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2') },
        mute: v('mute'),
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        lv: {
          green: v('green'),
          'green-ink': v('green-ink'),
          'green-soft': v('green-soft'),
          yellow: v('yellow'),
          'yellow-ink': v('yellow-ink'),
          'yellow-soft': v('yellow-soft'),
          orange: v('orange'),
          'orange-ink': v('orange-ink'),
          'orange-soft': v('orange-soft'),
          red: v('red'),
          'red-ink': v('red-ink'),
          'red-soft': v('red-soft'),
          none: v('none'),
          'none-ink': v('none-ink'),
          'none-soft': v('none-soft'),
        },
      },
      fontFamily: { sans: [v('font')] },
      fontSize: {
        sm: [v('text-sm'), { lineHeight: '1.6' }],
        base: [v('text-base'), { lineHeight: '1.7' }],
        lg: [v('text-lg'), { lineHeight: '1.6' }],
        xl: [v('text-xl'), { lineHeight: '1.5' }],
        '2xl': [v('text-2xl'), { lineHeight: '1.4' }],
        '3xl': [v('text-3xl'), { lineHeight: '1.3' }],
      },
      borderRadius: { sm: v('radius-sm'), DEFAULT: v('radius'), lg: v('radius-lg') },
      boxShadow: { card: v('shadow'), lift: v('shadow-lg') },
      minHeight: { touch: v('touch'), 'touch-lg': v('touch-lg') },
      minWidth: { touch: v('touch') },
      transitionTimingFunction: { kh: v('ease') },
      transitionDuration: { kh: v('dur') },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'logo-in': {
          '0%': { opacity: '0', transform: 'scale(.86)' },
          '60%': { opacity: '1', transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: {
        'fade-up': 'fade-up var(--kh-dur-slow) var(--kh-ease) both',
        'logo-in': 'logo-in 900ms var(--kh-ease) both',
        'soft-pulse': 'pulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
