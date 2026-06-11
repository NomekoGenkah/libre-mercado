import { useEffect } from 'react'
import { Icon } from './icons'

// Diálogo modal. Cierra con Escape o clic en el velo.
export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} aria-hidden />
      <div
        className={`panel relative z-10 mt-6 w-full ${width} bg-surface shadow-lift animate-scaleIn`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-700 tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface2 hover:text-ink"
            aria-label="Cerrar"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2.5 border-t border-line bg-paper/40 px-6 py-4 rounded-b-xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

// Confirmación destructiva reutilizable.
export function ConfirmDialog({ open, onClose, onConfirm, title, mensaje, confirmLabel = 'Confirmar', loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <button className="btn-quiet" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger/12 text-danger">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <p className="pt-1 text-sm leading-relaxed text-ink-soft">{mensaje}</p>
      </div>
    </Modal>
  )
}
