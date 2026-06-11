/** @type {import('tailwindcss').Config} */
// Libre Mercado — tokens de color via CSS custom properties.
// El tema oscuro es el predeterminado; añadir la clase "light" a <html>
// activa el tema claro (acento esmeralda, fondos slate).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies — canales RGB en CSS var para que las variantes de
        // opacidad de Tailwind (/60, /12, etc.) funcionen correctamente.
        base:     'rgb(var(--color-base)     / <alpha-value>)',
        paper:    'rgb(var(--color-paper)    / <alpha-value>)',
        surface:  'rgb(var(--color-surface)  / <alpha-value>)',
        surface2: 'rgb(var(--color-surface2) / <alpha-value>)',

        ink: {
          DEFAULT: 'rgb(var(--color-ink)       / <alpha-value>)',
          soft:    'rgb(var(--color-ink-soft)   / <alpha-value>)',
          muted:   'rgb(var(--color-ink-muted)  / <alpha-value>)',
          faint:   'rgb(var(--color-ink-faint)  / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--color-line)        / <alpha-value>)',
          soft:    'rgb(var(--color-line-soft)   / <alpha-value>)',
          strong:  'rgb(var(--color-line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent)       / <alpha-value>)',
          hover:   'rgb(var(--color-accent-hover) / <alpha-value>)',
          soft:    'rgb(var(--color-accent-soft)  / <alpha-value>)',
          glow:    'rgb(var(--color-accent)       / <alpha-value>)',
        },
        ok:         'rgb(var(--color-ok)          / <alpha-value>)',
        okSoft:     'rgb(var(--color-ok-soft)     / <alpha-value>)',
        warn:       'rgb(var(--color-warn)        / <alpha-value>)',
        warnSoft:   'rgb(var(--color-warn-soft)   / <alpha-value>)',
        danger:     'rgb(var(--color-danger)      / <alpha-value>)',
        dangerSoft: 'rgb(var(--color-danger-soft) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontWeight: {
        400: '400', 500: '500', 600: '600',
        700: '700', 800: '800', 900: '900',
      },
      letterSpacing: {
        wider2: '0.12em',
        wider3: '0.2em',
      },
      // Esquinas más cuadradas: panel=4px, botón=4px, chip=2px.
      borderRadius: {
        DEFAULT: '0.25rem',   // 4px
        sm:      '0.125rem',  // 2px
        md:      '0.25rem',   // 4px
        lg:      '0.375rem',  // 6px
        xl:      '0.5rem',    // 8px
        '2xl':   '0.625rem',  // 10px
        full:    '9999px',
      },
      // Las sombras referencian CSS vars para que cambien con el tema.
      boxShadow: {
        frame: 'var(--shadow-frame)',
        lift:  'var(--shadow-lift)',
        glow:  'var(--shadow-glow)',
      },
      keyframes: {
        riseIn:    { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.97)' },      '100%': { opacity: '1', transform: 'scale(1)' } },
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        sweep:     { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        blink:     { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        dash:      { to: { 'stroke-dashoffset': '0' } },
        floatY:    { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        drift:     { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-60px)' } },
        glowPulse: { '0%, 100%': { opacity: '0.5', transform: 'scale(1)' }, '50%': { opacity: '0.85', transform: 'scale(1.06)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        spark:     { '0%': { 'stroke-dashoffset': '120', opacity: '0' }, '15%': { opacity: '1' }, '85%': { opacity: '1' }, '100%': { 'stroke-dashoffset': '-120', opacity: '0' } },
      },
      animation: {
        riseIn:    'riseIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
        scaleIn:   'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) both',
        fadeIn:    'fadeIn 0.4s ease both',
        sweep:     'sweep 0.6s cubic-bezier(0.16,1,0.3,1) both',
        blink:     'blink 1.3s steps(2, start) infinite',
        dash:      'dash 1.1s ease forwards',
        floatY:    'floatY 7s ease-in-out infinite',
        glowPulse: 'glowPulse 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
