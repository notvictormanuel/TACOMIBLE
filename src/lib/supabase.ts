import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && clave)

export const supabase: SupabaseClient = configurado
  ? createClient(url!, clave!, {
      auth: {
        // La sesión queda guardada en el celular para no pedir el PIN cada vez.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'lista-turno-sesion',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : (null as unknown as SupabaseClient)

/** Llama una función RPC y devuelve el dato o lanza un Error con mensaje en español. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(traducirError(error.message))
  return data as T
}

export function traducirError(mensaje: string): string {
  if (/Failed to fetch|NetworkError|Load failed/i.test(mensaje)) {
    return 'Sin conexión. Revisa el internet e intenta de nuevo.'
  }
  if (/Invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.'
  if (/Anonymous sign-ins are disabled/i.test(mensaje)) {
    return 'El acceso con PIN no está activado. El administrador debe activar "Anonymous sign-ins" en Supabase.'
  }
  if (/JWT|jwt expired/i.test(mensaje)) return 'Tu sesión venció. Vuelve a entrar.'
  return mensaje
}
