import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, ErrorBanner } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, TextInput } from '../components/ui/Field'
import { SearchBox } from './Productos'
import { Icon } from '../components/ui/icons'
import { folio } from '../lib/format'

const VACIO = { proveedor: '', contacto: '', email: '' }

export default function Proveedores() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeEditar = tieneRol('admin', 'bodeguero')
  const puedeBorrar = tieneRol('admin')

  const { datos, error, cargando, refrescar } = useFetch('/proveedores')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const filas = useMemo(() => {
    const lista = datos || []
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((p) => p.proveedor?.toLowerCase().includes(q) || p.contacto?.toLowerCase().includes(q))
  }, [datos, busca])

  const abrirCrear = () => {
    setForm(VACIO)
    setErrores({})
    setModal({ modo: 'crear' })
  }
  const abrirEditar = (p) => {
    setForm({ proveedor: p.proveedor || '', contacto: p.contacto || '', email: p.email || '' })
    setErrores({})
    setModal({ modo: 'editar', prov: p })
  }

  const validar = () => {
    const e = {}
    if (!form.proveedor.trim()) e.proveedor = 'Requerido'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email inválido'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    const cuerpo = {
      proveedor: form.proveedor.trim(),
      contacto: form.contacto.trim() || null,
      email: form.email.trim() || null,
    }
    try {
      if (modal.modo === 'crear') {
        await api.post('/proveedores', cuerpo)
        toast.ok('Proveedor creado.')
      } else {
        await api.put(`/proveedores/${modal.prov.id_prov}`, cuerpo)
        toast.ok('Proveedor actualizado.')
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
      await api.del(`/proveedores/${aBorrar.id_prov}`)
      toast.ok(`Proveedor "${aBorrar.proveedor}" desactivado.`)
      setABorrar(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const columnas = [
    { clave: 'id_prov', etiqueta: 'ID', ancho: '64px', render: (p) => <span className="font-mono text-ink-faint">#{folio(p.id_prov)}</span> },
    { clave: 'proveedor', etiqueta: 'Proveedor', render: (p) => <span className="font-600 text-ink">{p.proveedor}</span> },
    { clave: 'contacto', etiqueta: 'Contacto', render: (p) => p.contacto || '—' },
    { clave: 'email', etiqueta: 'Email', render: (p) => <span className="font-mono text-xs text-ink-muted">{p.email || '—'}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="Catálogo"
        titulo="Proveedores"
        descripcion="Proveedores para reabastecimiento (nodo central). Referenciados por las compras de cada sucursal."
      >
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar proveedor…" />
        {puedeEditar && (
          <button className="btn-primary" onClick={abrirCrear}>
            <Icon name="plus" className="h-4 w-4" /> Nuevo proveedor
          </button>
        )}
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title={`Proveedores · ${filas.length} registros`} bodyClassName="p-0">
        <DataTable
          columnas={columnas}
          filas={filas}
          keyField="id_prov"
          cargando={cargando}
          vacioTitulo="Sin proveedores"
          acciones={
            puedeEditar || puedeBorrar
              ? (p) => (
                  <>
                    {puedeEditar && (
                      <button className="btn-quiet btn-sm" onClick={() => abrirEditar(p)}>
                        Editar
                      </button>
                    )}
                    {puedeBorrar && (
                      <button className="btn-danger btn-sm" onClick={() => setABorrar(p)}>
                        Borrar
                      </button>
                    )}
                  </>
                )
              : undefined
          }
        />
      </Panel>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo proveedor' : `Editar · ${modal?.prov?.proveedor}`}
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
          <Field label="Razón social" required error={errores.proveedor}>
            <TextInput value={form.proveedor} invalid={!!errores.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Distribuidora ..." />
          </Field>
          <Field label="Contacto">
            <TextInput value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Persona de contacto" />
          </Field>
          <Field label="Email" error={errores.email}>
            <TextInput type="email" value={form.email} invalid={!!errores.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ventas@proveedor.cl" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={borrar}
        loading={borrando}
        title="Desactivar proveedor"
        confirmLabel="Desactivar"
        mensaje={`Borrado lógico del proveedor "${aBorrar?.proveedor}". ¿Continuar?`}
      />
    </>
  )
}
