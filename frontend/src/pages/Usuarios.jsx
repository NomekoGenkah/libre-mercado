import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, ErrorBanner } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, TextInput, Select } from '../components/ui/Field'
import { SearchBox } from './Productos'
import { Icon } from '../components/ui/icons'
import { folio } from '../lib/format'

const ROLES = ['admin', 'vendedor', 'bodeguero']
const TONO_ROL = { admin: 'accent', vendedor: 'ok', bodeguero: 'warn' }
const VACIO = { username: '', password: '', rol: 'vendedor', id_cli: '' }

export default function Usuarios() {
  const toast = useToast()
  const { datos, error, cargando, refrescar } = useFetch('/usuarios')
  const { datos: clientes } = useFetch('/clientes')
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
    return lista.filter((u) => u.username?.toLowerCase().includes(q) || u.rol?.includes(q))
  }, [datos, busca])

  const abrirCrear = () => {
    setForm(VACIO)
    setErrores({})
    setModal({ modo: 'crear' })
  }
  const abrirEditar = (u) => {
    setForm({ username: u.username || '', password: '', rol: u.rol || 'vendedor', id_cli: u.id_cli != null ? String(u.id_cli) : '' })
    setErrores({})
    setModal({ modo: 'editar', usr: u })
  }

  const validar = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Requerido'
    if (modal.modo === 'crear' && !form.password) e.password = 'Requerido al crear'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    const base = {
      username: form.username.trim(),
      rol: form.rol,
      id_cli: form.id_cli ? Number(form.id_cli) : null,
    }
    try {
      if (modal.modo === 'crear') {
        await api.post('/usuarios', { ...base, password: form.password })
        toast.ok('Usuario creado.')
      } else {
        // password sólo se envía si se escribió uno nuevo.
        const cuerpo = form.password ? { ...base, password: form.password } : base
        await api.put(`/usuarios/${modal.usr.id_usr}`, cuerpo)
        toast.ok('Usuario actualizado.')
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
      await api.del(`/usuarios/${aBorrar.id_usr}`)
      toast.ok(`Usuario "${aBorrar.username}" desactivado.`)
      setABorrar(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBorrando(false)
    }
  }

  const columnas = [
    { clave: 'id_usr', etiqueta: 'ID', ancho: '64px', render: (u) => <span className="font-mono text-ink-faint">#{folio(u.id_usr)}</span> },
    { clave: 'username', etiqueta: 'Usuario', render: (u) => <span className="font-mono font-600 text-ink">{u.username}</span> },
    { clave: 'rol', etiqueta: 'Rol', render: (u) => <Chip tono={TONO_ROL[u.rol] || 'neutral'}>{u.rol}</Chip> },
    { clave: 'cliente', etiqueta: 'Cliente vinculado', render: (u) => u.cliente || <span className="text-ink-faint">—</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="Administración"
        titulo="Usuarios"
        descripcion="Cuentas de acceso (nodo central). Las contraseñas se almacenan cifradas con bcrypt."
      >
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar usuario…" />
        <button className="btn-primary" onClick={abrirCrear}>
          <Icon name="plus" className="h-4 w-4" /> Nuevo usuario
        </button>
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title={`Usuarios · ${filas.length} registros`} bodyClassName="p-0">
        <DataTable
          columnas={columnas}
          filas={filas}
          keyField="id_usr"
          cargando={cargando}
          vacioTitulo="Sin usuarios"
          acciones={(u) => (
            <>
              <button className="btn-quiet btn-sm" onClick={() => abrirEditar(u)}>
                Editar
              </button>
              <button className="btn-danger btn-sm" onClick={() => setABorrar(u)}>
                Borrar
              </button>
            </>
          )}
        />
      </Panel>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo usuario' : `Editar · ${modal?.usr?.username}`}
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Usuario" required error={errores.username}>
              <TextInput value={form.username} invalid={!!errores.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="usuario" autoComplete="off" />
            </Field>
            <Field label="Rol" required>
              <Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label={modal?.modo === 'crear' ? 'Contraseña' : 'Nueva contraseña'}
            required={modal?.modo === 'crear'}
            error={errores.password}
            hint={modal?.modo === 'editar' ? 'Dejar en blanco para mantener la actual.' : undefined}
          >
            <TextInput type="password" value={form.password} invalid={!!errores.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <Field label="Cliente vinculado" hint="Opcional. El admin no suele tener cliente asociado.">
            <Select value={form.id_cli} onChange={(e) => setForm({ ...form, id_cli: e.target.value })}>
              <option value="">— Sin vincular —</option>
              {(clientes || []).map((c) => (
                <option key={c.id_cli} value={c.id_cli}>
                  {c.nombre} ({c.email})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={borrar}
        loading={borrando}
        title="Desactivar usuario"
        confirmLabel="Desactivar"
        mensaje={`Borrado lógico del usuario "${aBorrar?.username}". No podrá iniciar sesión. ¿Continuar?`}
      />
    </>
  )
}
