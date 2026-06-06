import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

// ===========================================================================
//  Hook de lectura simple. Hace api.get(url) y expone { datos, error, cargando,
//  refrescar }. `deps` controla cuándo re-disparar. Si url es null, no consulta.
// ===========================================================================
export function useFetch(url, deps = []) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  const refrescar = useCallback(() => {
    if (!url) {
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    api
      .get(url)
      .then(setDatos)
      .catch((e) => setError(e.message || 'Error al cargar'))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    refrescar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescar, ...deps])

  return { datos, error, cargando, refrescar, setDatos }
}
