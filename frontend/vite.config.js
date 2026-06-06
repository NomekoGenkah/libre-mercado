import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El frontend corre fuera de Docker en localhost:5173 (Vite dev server).
// El backend PHP/Apache responde en localhost:8080. CORS + cookies de sesión
// se manejan en el cliente axios (withCredentials) y en index.php del backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
