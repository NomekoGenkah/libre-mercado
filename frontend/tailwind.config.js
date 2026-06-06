/** @type {import('tailwindcss').Config} */
// Consola técnica clara: paleta slate/gris, acento azul eléctrico, esquinas
// rectas (borderRadius neutralizado) y tipografías industriales + monoespaciada
// para datos. Las decoraciones geométricas viven en los componentes.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // Sin bordes redondos en TODO el sistema (requerimiento de diseño).
    borderRadius: {
      none: '0',
      DEFAULT: '0',
    },
    extend: {
      colors: {
        paper: '#f4f5f7',
        surface: '#ffffff',
        ink: {
          DEFAULT: '#15181d',
          soft: '#2b303a',
          muted: '#5b6472',
          faint: '#8b93a1',
        },
        line: {
          DEFAULT: '#d6dae1',
          soft: '#e6e9ee',
          strong: '#15181d',
        },
        accent: {
          DEFAULT: '#1c44ff',
          hover: '#1535d6',
          soft: '#e8ecff',
        },
        ok: '#15803d',
        okSoft: '#dcfce7',
        warn: '#b45309',
        warnSoft: '#fef3c7',
        danger: '#b91c1c',
        dangerSoft: '#fee2e2',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        wider2: '0.14em',
        wider3: '0.22em',
      },
      boxShadow: {
        frame: '0 1px 0 0 #d6dae1, 0 12px 30px -22px rgba(21,24,29,0.4)',
        lift: '0 18px 40px -26px rgba(21,24,29,0.55)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        dash: {
          to: { 'stroke-dashoffset': '0' },
        },
      },
      animation: {
        riseIn: 'riseIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
        fadeIn: 'fadeIn 0.4s ease both',
        sweep: 'sweep 0.6s cubic-bezier(0.16,1,0.3,1) both',
        blink: 'blink 1.2s steps(2, start) infinite',
        dash: 'dash 1.1s ease forwards',
      },
    },
  },
  plugins: [],
}
