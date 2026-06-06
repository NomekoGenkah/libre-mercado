import { createContext, useCallback, useContext, useState } from 'react'

// ===========================================================================
//  Toasts técnicos (esquina inferior derecha). API: toast.ok / .error / .info.
// ===========================================================================

const ToastContext = createContext(null)
let semilla = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const quitar = useCallback((id) => {
    setItems((xs) => xs.filter((t) => t.id !== id))
  }, [])

  const empujar = useCallback(
    (tipo, mensaje, ms = 4200) => {
      const id = ++semilla
      setItems((xs) => [...xs, { id, tipo, mensaje }])
      if (ms) setTimeout(() => quitar(id), ms)
      return id
    },
    [quitar],
  )

  const toast = {
    ok: (m) => empujar('ok', m),
    error: (m) => empujar('error', m),
    info: (m) => empujar('info', m),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[120] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {items.map((t) => (
          <ToastItem key={t.id} {...t} onClose={() => quitar(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ESTILOS = {
  ok: { borde: 'border-ok', etq: 'OK', color: 'text-ok' },
  error: { borde: 'border-danger', etq: 'ERR', color: 'text-danger' },
  info: { borde: 'border-accent', etq: 'LOG', color: 'text-accent' },
}

function ToastItem({ tipo, mensaje, onClose }) {
  const s = ESTILOS[tipo] || ESTILOS.info
  return (
    <div
      className={`panel ${s.borde} border-l-[3px] bg-surface px-3.5 py-3 shadow-lift animate-riseIn`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 font-mono text-[10px] tracking-wider2 ${s.color}`}>{s.etq}</span>
        <p className="flex-1 text-sm leading-snug text-ink-soft">{mensaje}</p>
        <button
          onClick={onClose}
          className="font-mono text-xs text-ink-faint hover:text-ink"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
