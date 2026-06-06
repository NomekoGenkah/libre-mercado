// Campos de formulario consistentes (label técnico + control + error).

export function Field({ label, error, hint, children, required }) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block font-mono text-[11px] text-danger">{error}</span>}
    </label>
  )
}

export function TextInput({ invalid, className = '', ...props }) {
  return <input className={`input ${invalid ? 'input-invalid' : ''} ${className}`} {...props} />
}

export function TextArea({ invalid, className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`input h-auto py-2 leading-relaxed ${invalid ? 'input-invalid' : ''} ${className}`}
      {...props}
    />
  )
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select className={`input ${invalid ? 'input-invalid' : ''} ${className}`} {...props}>
      {children}
    </select>
  )
}
