import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de axios: http = axios.create() devuelve un objeto de métodos controlable.
const h = vi.hoisted(() => ({
  metodos: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('axios', () => ({
  default: { create: () => h.metodos },
}))

import { api, ApiError } from './client'

beforeEach(() => {
  Object.values(h.metodos).forEach((m) => m.mockReset())
})

describe('api — desenvolver respuesta', () => {
  it('extrae data del sobre {ok:true,data} en GET', async () => {
    h.metodos.get.mockResolvedValue({ data: { ok: true, data: [{ id_prod: 1 }] } })
    const out = await api.get('/productos')
    expect(out).toEqual([{ id_prod: 1 }])
    expect(h.metodos.get).toHaveBeenCalledWith('/productos', undefined)
  })

  it('reenvía body y config en POST', async () => {
    h.metodos.post.mockResolvedValue({ data: { ok: true, data: { id_venta: 9 } } })
    const out = await api.post('/ventas', { id_cli: 1 })
    expect(out).toEqual({ id_venta: 9 })
    expect(h.metodos.post).toHaveBeenCalledWith('/ventas', { id_cli: 1 }, undefined)
  })
})

describe('api — normalización de errores', () => {
  it('convierte {ok:false} (HTTP error) en ApiError con código y detalle', async () => {
    h.metodos.post.mockRejectedValue({
      response: { status: 409, data: { ok: false, error: 'Stock insuficiente', detalle: { id_prod: 1 } } },
    })
    const err = await api.post('/ventas', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('Stock insuficiente')
    expect(err.codigo).toBe(409)
    expect(err.detalle).toEqual({ id_prod: 1 })
  })

  it('marca el backend inaccesible (ERR_NETWORK) como código 0', async () => {
    h.metodos.get.mockRejectedValue({ code: 'ERR_NETWORK' })
    const err = await api.get('/salud').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.codigo).toBe(0)
    expect(err.message).toMatch(/backend/i)
  })

  it('ApiError es una Error de verdad', () => {
    const e = new ApiError('x', 500)
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('ApiError')
  })
})
