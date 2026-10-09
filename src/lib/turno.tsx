import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { rpc, supabase, traducirError } from './supabase'
import { hoyBogota } from './fecha'
import type { Asignacion, Asignado, Distribucion, Empleado, Marca, Perfil, Rol, Tarea } from './tipos'

type Tabla = 'empleados' | 'tareas' | 'asignaciones' | 'marcas'

interface Turno {
  perfil: Perfil
  hoy: string
  cargando: boolean
  error: string | null
  empleados: Empleado[]
  tareas: Tarea[]
  marcas: Marca[]
  distribucion: Distribucion
  /** Sube cada vez que llega un cambio en tiempo real (para que otras vistas recarguen). */
  version: number
  asignadoA: (rol: Rol, asignacion?: Asignacion | null) => Asignado | null
  nombreDe: (a: Asignado | null | undefined) => string | null
  recargar: (...tablas: Tabla[]) => Promise<void>
}

const Contexto = createContext<Turno | null>(null)

export function useTurno(): Turno {
  const t = useContext(Contexto)
  if (!t) throw new Error('useTurno fuera de TurnoProvider')
  return t
}

export function TurnoProvider({
  perfil,
  alPerderAcceso,
  children,
}: {
  perfil: Perfil
  alPerderAcceso: () => void
  children: ReactNode
}) {
  const [hoy, setHoy] = useState(hoyBogota)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [ultima, setUltima] = useState<Asignacion | null>(null)
  const [version, setVersion] = useState(0)
  const hoyRef = useRef(hoy)
  hoyRef.current = hoy
  const perderRef = useRef(alPerderAcceso)
  perderRef.current = alPerderAcceso

  const cargadores = useMemo(
    () => ({
      empleados: async () => {
        const { data, error } = await supabase.from('empleados').select('id, nombre, activo').order('nombre')
        if (error) throw error
        setEmpleados(data as Empleado[])
      },
      tareas: async () => {
        const { data, error } = await supabase
          .from('tareas')
          .select('id, rol, bloque, texto, orden, creado_por, creado_en')
          .is('borrada_en', null)
          .order('orden')
        if (error) throw error
        setTareas(data as Tarea[])
      },
      asignaciones: async () => {
        const { data, error } = await supabase
          .from('asignaciones')
          .select('fecha, roles, definido_por, definido_en')
          .lte('fecha', hoyRef.current)
          .order('fecha', { ascending: false })
          .limit(1)
        if (error) throw error
        setUltima((data?.[0] as Asignacion) ?? null)
      },
      marcas: async () => {
        const { data, error } = await supabase
          .from('marcas')
          .select('id, fecha, empleado_id, nombre, tarea_id, rol, hora')
          .eq('fecha', hoyRef.current)
        if (error) throw error
        setMarcas(data as Marca[])
      },
    }),
    [],
  )

  const verificarAcceso = useCallback(async () => {
    try {
      const p = await rpc<Perfil>('mi_perfil')
      if (!p.admin && !p.empleado_id) perderRef.current()
    } catch {
      /* sin conexión: se reintenta luego */
    }
  }, [])

  const recargar = useCallback(
    async (...tablas: Tabla[]) => {
      const lista: Tabla[] = tablas.length ? tablas : ['empleados', 'tareas', 'asignaciones', 'marcas']
      try {
        await Promise.all(lista.map((t) => cargadores[t]()))
        setError(null)
      } catch (e) {
        setError(traducirError((e as Error).message))
      } finally {
        setCargando(false)
      }
    },
    [cargadores],
  )

  // Carga inicial y cuando cambia el día.
  useEffect(() => {
    recargar()
  }, [hoy, recargar])

  // Tiempo real: cualquier cambio en otra pantalla o dispositivo recarga esa tabla.
  useEffect(() => {
    const pendientes = new Set<Tabla>()
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const programar = (t: Tabla) => {
      pendientes.add(t)
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        const lista = [...pendientes]
        pendientes.clear()
        recargar(...lista)
        setVersion((v) => v + 1)
        if (lista.includes('empleados')) verificarAcceso()
      }, 150)
    }
    const canal = supabase.channel('lista-de-turno')
    for (const tabla of ['empleados', 'tareas', 'asignaciones', 'marcas'] as Tabla[]) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => programar(tabla))
    }
    canal.subscribe((estado) => {
      // Al reconectar puede que nos hayamos perdido cambios.
      if (estado === 'SUBSCRIBED') programar('marcas')
    })
    return () => {
      clearTimeout(temporizador)
      supabase.removeChannel(canal)
    }
  }, [recargar, verificarAcceso])

  // Al volver a la app (el celular la suspende) o al pasar la medianoche.
  useEffect(() => {
    const revisar = () => {
      const h = hoyBogota()
      if (h !== hoyRef.current) setHoy(h)
      else if (document.visibilityState === 'visible') {
        recargar()
        setVersion((v) => v + 1)
      }
      verificarAcceso()
    }
    const alVer = () => document.visibilityState === 'visible' && revisar()
    document.addEventListener('visibilitychange', alVer)
    window.addEventListener('online', revisar)
    const reloj = setInterval(() => {
      const h = hoyBogota()
      if (h !== hoyRef.current) setHoy(h)
    }, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', alVer)
      window.removeEventListener('online', revisar)
      clearInterval(reloj)
    }
  }, [recargar, verificarAcceso])

  const distribucion: Distribucion = useMemo(() => {
    if (!ultima) return { estado: 'vacia', asignacion: null }
    return { estado: ultima.fecha === hoy ? 'confirmada' : 'heredada', asignacion: ultima }
  }, [ultima, hoy])

  const asignadoA = useCallback(
    (rol: Rol, asignacion: Asignacion | null = distribucion.asignacion) => asignacion?.roles?.[rol] ?? null,
    [distribucion],
  )

  // Muestra el nombre actual si la persona sigue en el equipo; si no, el guardado.
  const nombreDe = useCallback(
    (a: Asignado | null | undefined) => {
      if (!a) return null
      return empleados.find((e) => e.id === a.empleado_id && e.activo)?.nombre ?? a.nombre
    },
    [empleados],
  )

  const valor: Turno = {
    perfil,
    hoy,
    cargando,
    error,
    empleados,
    tareas,
    marcas,
    distribucion,
    version,
    asignadoA,
    nombreDe,
    recargar,
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
