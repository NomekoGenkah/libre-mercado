import { expect } from '@playwright/test'

// Credenciales sembradas por el seed del backend.
export const USUARIOS = {
  admin: { u: 'admin', p: 'admin123' },
  vendedor: { u: 'vendedor', p: 'vendedor123' },
  bodeguero: { u: 'bodeguero', p: 'bodeguero123' },
}

// Inicia sesión vía la UI y espera a aterrizar en el dashboard.
export async function login(page, quien = 'admin') {
  const { u, p } = USUARIOS[quien]
  await page.goto('/login')
  await page.getByPlaceholder('admin').fill(u)
  await page.getByPlaceholder('••••••••').fill(p)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}
