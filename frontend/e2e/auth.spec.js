import { test, expect } from '@playwright/test'
import { login, USUARIOS } from './helpers'

test.describe('Autenticación', () => {
  test('redirige a /login cuando no hay sesión', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible()
  })

  test('rechaza credenciales inválidas', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('admin').fill('admin')
    await page.getByPlaceholder('••••••••').fill('clave-incorrecta')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login de admin y cierre de sesión', async ({ page }) => {
    await login(page, 'admin')
    await expect(page.getByRole('heading', { name: /hola, admin/i })).toBeVisible()
    // El rol aparece en la topbar.
    await expect(page.getByText('admin', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /salir/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('botón de credenciales demo rellena el formulario', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: new RegExp(`${USUARIOS.vendedor.u}`) }).first().click()
    await expect(page.getByPlaceholder('admin')).toHaveValue('vendedor')
  })
})
