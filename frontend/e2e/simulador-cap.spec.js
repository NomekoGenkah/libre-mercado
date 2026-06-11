import { test, expect } from '@playwright/test'
import { login } from './helpers'

// La pantalla estrella de la defensa: ejecuta POST /debug/simular-fallo, que
// reproduce una venta, falla antes del COMMIT y revierte en ambos nodos.
// Es segura: el backend no persiste nada.
test.describe('Simulador de fallo CAP', () => {
  test('ejecuta la simulación y verifica que la consistencia se preserva', async ({ page }) => {
    await login(page, 'admin')
    await page.getByRole('link', { name: /simulador cap/i }).click()
    await expect(page).toHaveURL(/\/simulador-cap/)
    await expect(page.getByRole('heading', { name: /simulador de fallo distribuido/i })).toBeVisible()

    // Estado de reposo antes de ejecutar.
    await expect(page.getByText(/simulación en espera/i)).toBeVisible()

    await page.getByRole('button', { name: /ejecutar simulación/i }).click()

    // Veredicto: consistencia preservada (el rollback dejó el stock intacto).
    await expect(page.getByText('CONSISTENCIA PRESERVADA')).toBeVisible({ timeout: 15_000 })

    // La venta NO quedó registrada y se ejecutaron los rollbacks.
    await expect(page.getByText(/venta no registrada/i)).toBeVisible()
    await expect(page.getByText(/rollback central/i)).toBeVisible()
    await expect(page.getByText(/rollback sucursal/i)).toBeVisible()

    // Timeline y comparativa de stock presentes.
    await expect(page.getByText(/timeline de ejecución/i)).toBeVisible()
    await expect(page.getByText(/antes \/ durante \/ después/i)).toBeVisible()

    // Explicación CP visible.
    await expect(page.getByText(/por qué es CP/i)).toBeVisible()
  })
})
