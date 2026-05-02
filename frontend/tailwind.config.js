/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'surface':                    'var(--lv-surface)',
        'surface-container':          'var(--lv-surface-container)',
        'surface-container-low':      'var(--lv-surface-container-low)',
        'surface-container-high':     'var(--lv-surface-container-high)',
        'on-surface':                 'var(--lv-on-surface)',
        'secondary-container':        'var(--lv-secondary-container)',
        // Static tokens
        'secondary-fixed-dim':        '#e9c349',
        'outline-variant':            '#444748',
      },
      fontFamily: {
        'body-lg':    ['Manrope', 'sans-serif'],
        'body-md':    ['Manrope', 'sans-serif'],
        'label-md':   ['Manrope', 'sans-serif'],
        'label-sm':   ['Manrope', 'sans-serif'],
        'headline-lg':['Noto Serif', 'serif'],
        'headline-md':['Noto Serif', 'serif'],
        'display-xl': ['Noto Serif', 'serif'],
        serif:        ['Noto Serif', 'serif'],
      },
      fontSize: {
        'body-lg':    ['18px', { lineHeight: '1.6',  fontWeight: '400' }],
        'label-md':   ['14px', { lineHeight: '1.2',  letterSpacing: '0.05em', fontWeight: '600' }],
        'headline-lg':['32px', { lineHeight: '1.2',  fontWeight: '600' }],
        'headline-md':['24px', { lineHeight: '1.3',  fontWeight: '500' }],
        'body-md':    ['16px', { lineHeight: '1.5',  fontWeight: '400' }],
        'display-xl': ['48px', { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'label-sm':   ['12px', { lineHeight: '1.2',  fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        full:    '9999px',
      },
    },
  },
  plugins: [],
};
