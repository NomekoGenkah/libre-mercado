import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, ErrorBanner } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, TextInput, TextArea, Select } from '../components/ui/Field'
import { dinero, folio } from '../lib/format'

const VACIO = { producto: '', precio: '', descripcion: '', id_cat: '' }

export default function Productos() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeEditar = tieneRol('admin')

  const { datos, error, cargando, refrescar } = useFetch('/productos')
  const { datos: categorias } = useFetch('/categorias')
  const [busca, setBusca] = useState('')

  const [modal, setModal] = useState(null) // {modo:'crear'|'editar', prod}
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const filas = useMemo(() => {
    const lista = datos || []
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(
      (p) =>
        p.producto?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q) ||
        String(p.id_prod).includes(q),
    )
  }, [datos, busca])

  const abrirCrear = () => {
    setForm(VACIO)
    setErrores({})
    setModal({ modo: 'crear' })
  }
  const abrirEditar = (prod) => {
    setForm({
      producto: prod.producto || '',
      precio: String(prod.precio ?? ''),
      descripcion: prod.descripcion || '',
      id_cat: prod.id_cat != null ? String(prod.id_cat) : '',
    })
    setErrores({})
    setModal({ modo: 'editar', prod })
  }

  const validar = () => {
    const e = {}
    if (!form.producto.trim()) e.producto = 'Requerido'
    const precio = Number(form.precio)
    if (form.precio === '' || Number.isNaN(precio) || precio < 0) e.precio = 'Número ≥ 0'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    const cuerpo = {
      producto: form.producto.trim(),
      precio: Number(form.precio),
      descripcion: form.descripcion.trim() || null,
      id_cat: form.id_cat ? Number(form.id_cat) : null,
    }
    try {
      if (modal.modo === 'crear') {
        await api.post('/productos', cuerpo)
        toast.ok('Producto creado.')
      } else {
        await api.put(`/productos/${modal.prod.id_prod}`, cuerpo)
        toast.ok('Producto actualizado.')
      }
      setModal(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    setBorrando(true)
    try {
      await api.del(`/productos/${aBorrar.id_prod}`)
      toast.ok(`Producto "${aBorrar.producto}" desactivado.`)
      setABorrar(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const columnas = [
    { clave: 'id_prod', etiqueta: 'ID', ancho: '64px', render: (p) => <span className="font-mono text-ink-faint">#{folio(p.id_prod)}</span> },
    { clave: 'producto', etiqueta: 'Producto', render: (p) => <span className="font-600 text-ink">{p.producto}</span> },
    {
      clave: 'categoria',
      etiqueta: 'Categoría',
      render: (p) => (p.categoria ? <Chip tono="neutral">{p.categoria}</Chip> : <span className="text-ink-faint">—</span>),
    },
    { clave: 'descripcion', etiqueta: 'Descripción', render: (p) => <span className="text-ink-muted">{p.descripcion || '—'}</span> },
    { clave: 'precio', etiqueta: 'Precio', alinear: 'right', render: (p) => <span className="font-600">{dinero(p.precio)}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="CAT · 01"
        titulo="Productos"
        descripcion="Catálogo global (nodo central). El borrado es lógico: desactiva el producto sin romper historiales."
      >
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar producto…" />
        {puedeEditar && (
          <button className="btn-primary" onClick={abrirCrear}>
            + Nuevo producto
          </button>
        )}
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title={`Catálogo · ${filas.length} registros`} bodyClassName="p-0">
        <DataTable
          columnas={columnas}
          filas={filas}
          keyField="id_prod"
          cargando={cargando}
          vacioTitulo="Sin productos"
          vacioDetalle="No hay productos activos que coincidan."
          acciones={
            puedeEditar
              ? (p) => (
                  <>
                    <button className="btn-quiet btn-sm" onClick={() => abrirEditar(p)}>
                      Editar
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setABorrar(p)}>
                      Borrar
                    </button>
                  </>
                )
              : undefined
          }
        />
      </Panel>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo producto' : `Editar · ${modal?.prod?.producto}`}
        subtitle="Catálogo central · prepared statements en backend"
        footer={
          <>
            <button className="btn-quiet" onClick={() => setModal(null)} disabled={guardando}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre" required error={errores.producto}>
            <TextInput
              value={form.producto}
              invalid={!!errores.producto}
              onChange={(e) => setForm({ ...form, producto: e.target.value })}
              placeholder="Ej. Teclado mecánico"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio (CLP)" required error={errores.precio}>
              <TextInput
                type="number"
                min="0"
                value={form.precio}
                invalid={!!errores.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Categoría">
              <Select value={form.id_cat} onChange={(e) => setForm({ ...form, id_cat: e.target.value })}>
                <option value="">— Sin categoría —</option>
                {(categorias || []).map((c) => (
                  <option key={c.id_cat} value={c.id_cat}>
                    {c.categoria}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descripción">
            <TextArea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Detalle opcional…"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={borrar}
        loading={borrando}
        title="Desactivar producto"
        confirmLabel="Desactivar"
        mensaje={`Se aplicará borrado lógico (activo = 0) al producto "${aBorrar?.producto}". Podrá reactivarse desde la base de datos. ¿Continuar?`}
      />
    </>
  )
}

// Buscador compartido por las páginas de catálogo.
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-faint">
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full border border-line bg-surface pl-8 pr-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:w-64"
      />
    </div>
  )
}
