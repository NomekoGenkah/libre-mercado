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

const VACIO = { nombre: '', email: '', telefono: '' }

export default function Clientes() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeEditar = tieneRol('admin', 'vendedor')
  const puedeBorrar = tieneRol('admin')

  const { datos, error, cargando, refrescar } = useFetch('/clientes')
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
    return lista.filter((c) => c.nombre?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
  }, [datos, busca])

  const abrirCrear = () => {
    setForm(VACIO)
    setErrores({})
    setModal({ modo: 'crear' })
  }
  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre || '', email: c.email || '', telefono: c.telefono || '' })
    setErrores({})
    setModal({ modo: 'editar', cli: c })
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.email.trim()) e.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email inválido'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    const cuerpo = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      telefono: form.telefono.trim() || null,
    }
    try {
      if (modal.modo === 'crear') {
        await api.post('/clientes', cuerpo)
        toast.ok('Cliente creado.')
      } else {
        await api.put(`/clientes/${modal.cli.id_cli}`, cuerpo)
        toast.ok('Cliente actualizado.')
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
      await api.del(`/clientes/${aBorrar.id_cli}`)
      toast.ok(`Cliente "${aBorrar.nombre}" desactivado.`)
      setABorrar(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const columnas = [
    { clave: 'id_cli', etiqueta: 'ID', ancho: '64px', render: (c) => <span className="font-mono text-ink-faint">#{folio(c.id_cli)}</span> },
    { clave: 'nombre', etiqueta: 'Nombre', render: (c) => <span className="font-600 text-ink">{c.nombre}</span> },
    { clave: 'email', etiqueta: 'Email', render: (c) => <span className="font-mono text-xs text-ink-muted">{c.email}</span> },
    { clave: 'telefono', etiqueta: 'Teléfono', render: (c) => <span className="font-mono text-xs">{c.telefono || '—'}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="Catálogo"
        titulo="Clientes"
        descripcion="Maestro de clientes alojado en el nodo central. El email es único por cliente."
      >
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar cliente…" />
        {puedeEditar && (
          <button className="btn-primary" onClick={abrirCrear}>
            <Icon name="plus" className="h-4 w-4" /> Nuevo cliente
          </button>
        )}
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title={`Clientes · ${filas.length} registros`} bodyClassName="p-0">
        <DataTable
          columnas={columnas}
          filas={filas}
          keyField="id_cli"
          cargando={cargando}
          vacioTitulo="Sin clientes"
          acciones={
            puedeEditar || puedeBorrar
              ? (c) => (
                  <>
                    {puedeEditar && (
                      <button className="btn-quiet btn-sm" onClick={() => abrirEditar(c)}>
                        Editar
                      </button>
                    )}
                    {puedeBorrar && (
                      <button className="btn-danger btn-sm" onClick={() => setABorrar(c)}>
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
        title={modal?.modo === 'crear' ? 'Nuevo cliente' : `Editar · ${modal?.cli?.nombre}`}
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
          <Field label="Nombre" required error={errores.nombre}>
            <TextInput value={form.nombre} invalid={!!errores.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" />
          </Field>
          <Field label="Email" required error={errores.email}>
            <TextInput type="email" value={form.email} invalid={!!errores.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@correo.cl" />
          </Field>
          <Field label="Teléfono">
            <TextInput value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+56 9 ..." />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={borrar}
        loading={borrando}
        title="Desactivar cliente"
        confirmLabel="Desactivar"
        mensaje={`Borrado lógico del cliente "${aBorrar?.nombre}". No se permite si tiene un usuario activo asociado. ¿Continuar?`}
      />
    </>
  )
}
