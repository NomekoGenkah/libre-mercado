// Logotipo de Libre Mercado: marca geométrica (nodo central + enlaces) sobre
// un cuadro con degradado violeta. Usado en sidebar y login.
export function Brand({ className = 'h-9 w-9' }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`}>
      <svg viewBox="0 0 40 40" className="h-full w-full">
        <defs>
          <linearGradient id="brandg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8f73ff" />
            <stop offset="100%" stopColor="#5b3ff0" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#brandg)" />
        <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.95">
          <path d="M20 13 L12 27 M20 13 L28 27 M12 27 L28 27" />
        </g>
        <circle cx="20" cy="13" r="3.4" fill="#fff" />
        <circle cx="12" cy="27" r="2.6" fill="#fff" />
        <circle cx="28" cy="27" r="2.6" fill="#fff" />
      </svg>
    </span>
  )
}
