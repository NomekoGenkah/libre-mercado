import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Navegación y lectura de datos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
  })

  test('la topbar reporta el estado de los 4 nodos', async ({ page }) => {
    // /salud responde con central/norte/sur/este. Esperamos "Nodos 4/4".
    await expect(page.getByText(/nodos\s+4\/4/i)).toBeVisible()
  })

  test('Productos: lista el catálogo del nodo central', async ({ page }) => {
    await page.getByRole('link', { name: /productos/i }).click()
    await expect(page).toHaveURL(/\/productos/)
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
    await expect(page.getByText(/registros/i)).toBeVisible()
    // Cabeceras de la tabla.
    await expect(page.getByText('Precio', { exact: true }).first()).toBeVisible()
    // El admin ve el botón de alta.
    await expect(page.getByRole('button', { name: /nuevo producto/i })).toBeVisible()
  })

  test('Inventario: semáforo por sucursal y cambio de nodo', async ({ page }) => {
    await page.getByRole('link', { name: /inventario/i }).click()
    await expect(page).toHaveURL(/\/stock/)
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()
    // Tarjetas del semáforo.
    await expect(page.getByText(/en nivel óptimo/i)).toBeVisible()
    await expect(page.getByText(/crítico/i).first()).toBeVisible()
    // Cambiar a la sucursal Sur.
    await page.getByRole('button', { name: /sur/i }).click()
    await expect(page.getByText('Movimientos', { exact: true })).toBeVisible()
  })

  test('Ventas: muestra el historial (2PC)', async ({ page }) => {
    await page.getByRole('link', { name: /ventas/i }).click()
    await expect(page).toHaveURL(/\/ventas/)
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()
    await expect(page.getByText(/historial de ventas/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /nueva venta/i })).toBeVisible()
  })
})
