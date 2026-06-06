import axios from 'axios'

// ===========================================================================
//  Cliente HTTP central. El backend usa sesiones PHP (cookie), así que TODA
//  petición viaja con withCredentials. El backend responde el sobre:
//      éxito  -> { ok: true,  data: ... }
//      error  -> { ok: false, error: "mensaje", detalle?: ... }
//  Aquí desenvolvemos `data` y normalizamos los errores a una excepción con
//  { mensaje, codigo, detalle } para que las pantallas no repitan el parseo.
// ===========================================================================

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

export class ApiError extends Error {
  constructor(mensaje, codigo, detalle) {
    super(mensaje)
    this.name = 'ApiError'
    this.codigo = codigo
    this.detalle = detalle
  }
}

function desenvolver(res) {
  const cuerpo = res?.data
  if (cuerpo && typeof cuerpo === 'object' && 'ok' in cuerpo) {
    return cuerpo.ok ? cuerpo.data : Promise.reject(cuerpo)
  }
  return cuerpo
}

function alError(err) {
  // Error con respuesta del backend (sobre {ok:false,...} o HTTP de error).
  const cuerpo = err?.response?.data
  if (cuerpo && typeof cuerpo === 'object' && cuerpo.ok === false) {
    throw new ApiError(cuerpo.error || 'Error de la API', err.response.status, cuerpo.detalle)
  }
  // Backend inaccesible (CORS, red, contenedor caído).
  if (err?.code === 'ERR_NETWORK' || !err?.response) {
    throw new ApiError('No se pudo contactar la API (¿el backend está levantado en :8080?).', 0)
  }
  throw new ApiError(err?.message || 'Error inesperado', err?.response?.status)
}

async function pedir(promesa) {
  try {
    return desenvolver(await promesa)
  } catch (e) {
    if (e && e.ok === false) {
      throw new ApiError(e.error || 'Error de la API', undefined, e.detalle)
    }
    return alError(e)
  }
}

export const api = {
  get: (url, config) => pedir(http.get(url, config)),
  post: (url, body, config) => pedir(http.post(url, body, config)),
  put: (url, body, config) => pedir(http.put(url, body, config)),
  del: (url, config) => pedir(http.delete(url, config)),
}
