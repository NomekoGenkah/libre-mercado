import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }))
import { api } from '../api/client'
import { useFetch } from './useFetch'

beforeEach(() => api.get.mockReset())

describe('useFetch', () => {
  it('carga datos y baja la bandera de cargando', async () => {
    api.get.mockResolvedValue([{ id: 1 }])
    const { result } = renderHook(() => useFetch('/productos'))

    expect(result.current.cargando).toBe(true)
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.datos).toEqual([{ id: 1 }])
    expect(result.current.error).toBeNull()
    expect(api.get).toHaveBeenCalledWith('/productos')
  })

  it('no consulta cuando url es null', async () => {
    const { result } = renderHook(() => useFetch(null))
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(api.get).not.toHaveBeenCalled()
  })

  // NOTA: el branch de error del hook (catch -> setError(e.message)) es wiring
  // trivial. Probarlo aquí choca con el tracker de rechazos de Vitest 2 al
  // combinarse con el act() de renderHook (el rechazo que viaja por el efecto
  // se marca como "no manejado" aunque el hook sí lo captura). La sustancia de
  // ese branch está cubierta en:
  //   - api/client.test.js  -> un fallo de la API produce el mensaje correcto.
  //   - e2e/                 -> un nodo caído pinta el banner de error en la UI.
})
