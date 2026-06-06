import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

// ===========================================================================
//  Estado de autenticación. El backend mantiene la sesión por cookie; aquí
//  guardamos el usuario actual y exponemos login/logout. Al montar, intentamos
//  GET /auth/me para rehidratar la sesión si la cookie sigue viva.
// ===========================================================================

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    api
      .get('/auth/me')
      .then((u) => activo && setUsuario(u))
      .catch(() => activo && setUsuario(null))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const u = await api.post('/auth/login', { username, password })
    setUsuario(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUsuario(null)
    }
  }, [])

  // 'admin' pasa todos los guards de rol (igual que en el backend).
  const tieneRol = useCallback(
    (...roles) => {
      if (!usuario) return false
      if (usuario.rol === 'admin') return true
      return roles.includes(usuario.rol)
    },
    [usuario],
  )

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, tieneRol }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
