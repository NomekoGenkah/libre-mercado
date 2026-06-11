import { describe, it, expect } from 'vitest'
import { dinero, numero, fechaHora, folio, nombreNodo, NODO_POR_SUC } from './format'

describe('dinero', () => {
  it('formatea CLP con separador de miles y sin decimales', () => {
    const out = dinero(29990)
    expect(out).toContain('29.990')
    expect(out).toContain('$')
    expect(out).not.toContain(',00')
  })

  it('acepta strings numéricos (como llegan de la API)', () => {
    expect(dinero('45990.00')).toContain('45.990')
  })

  it('devuelve — para valores no numéricos (NaN)', () => {
    expect(dinero('abc')).toBe('—')
    expect(dinero(undefined)).toBe('—')
  })

  // Quirk conocido: Number(null) === 0, así que null se formatea como $0
  // (no como —). En la práctica los precios/totales llegan como número o
  // string desde la API, nunca null, así que no afecta a las pantallas.
  it('trata null como 0 (Number(null) === 0)', () => {
    expect(dinero(null)).toContain('0')
  })
})

describe('numero', () => {
  it('agrupa miles', () => {
    expect(numero(1234567)).toBe('1.234.567')
  })
  it('maneja 0 y strings', () => {
    expect(numero(0)).toBe('0')
    expect(numero('50')).toBe('50')
  })
  it('— para entradas inválidas (NaN)', () => {
    expect(numero('x')).toBe('—')
    expect(numero(undefined)).toBe('—')
  })
  it('trata null como 0 (mismo quirk que dinero)', () => {
    expect(numero(null)).toBe('0')
  })
})

describe('folio', () => {
  it('rellena con ceros a la izquierda (ancho 3 por defecto)', () => {
    expect(folio(7)).toBe('007')
    expect(folio(42)).toBe('042')
    expect(folio(1234)).toBe('1234')
  })
  it('respeta ancho personalizado', () => {
    expect(folio(3, 2)).toBe('03')
  })
})

describe('nombreNodo / NODO_POR_SUC', () => {
  it('mapea id_suc a su nodo Docker (norte=1, sur=2, este=3)', () => {
    expect(nombreNodo(1)).toBe('norte')
    expect(nombreNodo(2)).toBe('sur')
    expect(nombreNodo(3)).toBe('este')
    expect(NODO_POR_SUC).toEqual({ 1: 'norte', 2: 'sur', 3: 'este' })
  })
  it('— para id_suc desconocido', () => {
    expect(nombreNodo(99)).toBe('—')
    expect(nombreNodo(undefined)).toBe('—')
  })
})

describe('fechaHora', () => {
  it('formatea un datetime de MariaDB', () => {
    const out = fechaHora('2026-05-05 11:30:00')
    expect(out).not.toBe('—')
    expect(out).toContain('2026')
    expect(out).toContain('05')
  })
  it('— cuando no hay fecha', () => {
    expect(fechaHora(null)).toBe('—')
    expect(fechaHora('')).toBe('—')
  })
  it('devuelve el valor original si no es parseable', () => {
    expect(fechaHora('no-es-fecha')).toBe('no-es-fecha')
  })
})
