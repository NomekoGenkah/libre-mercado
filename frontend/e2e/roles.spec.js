import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Control de acceso por rol', () => {
  test('el vendedor no ve las secciones de admin', async ({ page }) => {
    await login(page, 'vendedor')
    await expect(page.getByRole('link', { name: /usuarios/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /simulador cap/i })).toHaveCount(0)
  })

  test('el vendedor no puede acceder a /usuarios por URL directa', async ({ page }) => {
    await login(page, 'vendedor')
    await page.goto('/usuarios')
    await expect(page).toHaveURL(/\/dashboard/) // SoloAdmin redirige
  })

  test('el vendedor no puede acceder al simulador por URL directa', async ({ page }) => {
    await login(page, 'vendedor')
    await page.goto('/simulador-cap')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('el bodeguero sí ve Reabastecimiento', async ({ page }) => {
    await login(page, 'bodeguero')
    await expect(page.getByRole('link', { name: /reabastecimiento/i })).toBeVisible()
  })

  test('el admin sí ve Usuarios y Simulador', async ({ page }) => {
    await login(page, 'admin')
    await expect(page.getByRole('link', { name: /usuarios/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /simulador cap/i })).toBeVisible()
  })
})
