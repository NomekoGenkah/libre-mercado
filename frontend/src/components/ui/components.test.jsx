import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StockDot, Chip, Vacio, ErrorBanner } from './primitives'
import { StatCard } from './StatCard'
import { DataTable } from './DataTable'

describe('StockDot — semáforo de inventario', () => {
  it.each([
    ['rojo', 'Crítico'],
    ['amarillo', 'Bajo'],
    ['verde', 'OK'],
  ])('estado %s -> etiqueta %s', (estado, etiqueta) => {
    render(<StockDot estado={estado} />)
    expect(screen.getByText(etiqueta)).toBeInTheDocument()
  })
})

describe('Chip', () => {
  it('renderiza su contenido', () => {
    render(<Chip tono="ok">Activo</Chip>)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('muestra etiqueta, valor y pista', () => {
    render(<StatCard etiqueta="Ventas" valor="12" pista="acumulado" sufijo="SKU" />)
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('acumulado')).toBeInTheDocument()
    expect(screen.getByText('SKU')).toBeInTheDocument()
  })
})

describe('DataTable', () => {
  const columnas = [
    { clave: 'producto', etiqueta: 'Producto' },
    { clave: 'precio', etiqueta: 'Precio', render: (f) => `$${f.precio}` },
  ]

  it('muestra estado de carga', () => {
    render(<DataTable columnas={columnas} filas={null} keyField="id" cargando />)
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument()
  })

  it('muestra estado vacío con título personalizado', () => {
    render(
      <DataTable columnas={columnas} filas={[]} keyField="id" cargando={false} vacioTitulo="Sin productos" />,
    )
    expect(screen.getByText('Sin productos')).toBeInTheDocument()
  })

  it('renderiza filas y aplica render() de columna', () => {
    const filas = [{ id: 1, producto: 'Teclado', precio: 45990 }]
    render(<DataTable columnas={columnas} filas={filas} keyField="id" cargando={false} />)
    expect(screen.getByText('Producto')).toBeInTheDocument()
    expect(screen.getByText('Teclado')).toBeInTheDocument()
    expect(screen.getByText('$45990')).toBeInTheDocument()
  })

  it('renderiza la columna de acciones cuando se provee', () => {
    const filas = [{ id: 1, producto: 'Teclado' }]
    render(
      <DataTable
        columnas={columnas}
        filas={filas}
        keyField="id"
        cargando={false}
        acciones={(f) => <button>Editar {f.producto}</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Editar Teclado' })).toBeInTheDocument()
    expect(screen.getByText('Acciones')).toBeInTheDocument()
  })
})

describe('Vacio / ErrorBanner', () => {
  it('Vacio muestra título y detalle', () => {
    render(<Vacio titulo="Nada" detalle="No hay datos" />)
    expect(screen.getByText('Nada')).toBeInTheDocument()
    expect(screen.getByText('No hay datos')).toBeInTheDocument()
  })
  it('ErrorBanner no renderiza nada sin children', () => {
    const { container } = render(<ErrorBanner />)
    expect(container).toBeEmptyDOMElement()
  })
  it('ErrorBanner muestra el mensaje', () => {
    render(<ErrorBanner>Falló algo</ErrorBanner>)
    expect(screen.getByText('Falló algo')).toBeInTheDocument()
  })
})
