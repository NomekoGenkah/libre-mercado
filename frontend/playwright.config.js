import { defineConfig, devices } from '@playwright/test'

// ===========================================================================
//  Pruebas end-to-end. Levantan el dev server de Vite (localhost:5173) y
//  ejercen la app contra el backend PHP REAL en localhost:8080.
//
//  REQUISITO: el stack del backend debe estar arriba antes de correrlas:
//      docker compose up -d        (en la raíz del repo)
//  Las pruebas hacen login real, navegan y ejecutan la simulación CAP (segura:
//  el backend la revierte). Solo /debug/simular-fallo escribe-y-revierte; el
//  resto son lecturas, así que no ensucian los datos de demo.
// ===========================================================================
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Vite dev server. Si ya hay uno corriendo en :5173, lo reutiliza.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
