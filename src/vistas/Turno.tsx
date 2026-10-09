import { useEffect, useRef, useState } from 'react'
import { useTurno } from '../lib/turno'
import { ROLES, type Rol } from '../lib/tipos'
import { Cargando } from '../componentes/ui'
import { Hoy } from './Hoy'
import { Puesto } from './Puesto'
import { Historial } from './Historial'
import { Equipo } from './Equipo'
import { Logo } from './Entrar'

const RUTAS = ['hoy', 'taquero', 'tortillero', 'auxiliar', 'cajero', 'historial', 'equipo'] as const
type Ruta = (typeof RUTAS)[number]

const leerRuta = (): Ruta | null => {
  const r = window.location.hash.replace(/^#\/?/, '') as Ruta
  return RUTAS.includes(r) ? r : null
}

export function Turno({ alSalir }: { alSalir: () => void }) {
  const { perfil, cargando, error, distribucion, empleados } = useTurno()
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta() ?? 'hoy')
  const yaUbicado = useRef(false)

  const irA = (r: string) => {
    window.location.hash = `/${r}`
  }

  useEffect(() => {
    const alCambiar = () => {
      setRuta(leerRuta() ?? 'hoy')
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  // Al entrar, el empleado va directo a la pestaña de su puesto de hoy.
  useEffect(() => {
    if (cargando || yaUbicado.current) return
    yaUbicado.current = true
    if (!perfil.empleado_id) return
    const mio = ROLES.find((r) => distribucion.asignacion?.roles?.[r.id]?.empleado_id === perfil.empleado_id)
    if (mio) irA(mio.id)
  }, [cargando, perfil.empleado_id, distribucion])

  const miRol: Rol | undefined = ROLES.find(
    (r) => perfil.empleado_id && distribucion.asignacion?.roles?.[r.id]?.empleado_id === perfil.empleado_id,
  )?.id

  const pestañas: { id: Ruta; nombre: string }[] = [
    { id: 'hoy', nombre: 'Hoy' },
    ...ROLES.map((r) => ({ id: r.id as Ruta, nombre: r.nombre })),
    { id: 'historial', nombre: 'Historial' },
    ...(perfil.admin ? [{ id: 'equipo' as Ruta, nombre: 'Equipo' }] : []),
  ]

  const nombreActual =
    (perfil.empleado_id && empleados.find((e) => e.id === perfil.empleado_id)?.nombre) || perfil.nombre

  let contenido
  if (cargando) contenido = <Cargando />
  else if (ruta === 'hoy') contenido = <Hoy irA={irA} />
  else if (ruta === 'historial') contenido = <Historial />
  else if (ruta === 'equipo') contenido = <Equipo />
  else contenido = <Puesto key={ruta} rol={ruta} />

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera-fila">
          <Logo tam={40} />
          <div className="cabecera-titulos">
            <span className="cabecera-titulo">Lista de Turno</span>
            <span className="cabecera-usuario">
              {nombreActual}
              {perfil.admin ? ' · Administrador' : ''}
            </span>
          </div>
          <BotonTema />
          <button className="btn btn-cabecera" onClick={alSalir}>
            Salir
          </button>
        </div>
        <div className="filete" aria-hidden="true" />
      </header>

      {error && (
        <p className="nota nota-alerta banda-error" role="alert">
          {error}
        </p>
      )}

      <main className="contenido">{contenido}</main>

      <nav className="pestanas" aria-label="Secciones">
        {pestañas.map((p) => (
          <a
            key={p.id}
            href={`#/${p.id}`}
            className={`pestana pestana-${p.id}${ruta === p.id ? ' activa' : ''}`}
            aria-current={ruta === p.id ? 'page' : undefined}
          >
            {p.nombre}
            {p.id === miRol && <span className="pestana-punto" aria-label="(tu puesto)" />}
          </a>
        ))}
      </nav>
    </div>
  )
}

type Tema = 'auto' | 'claro' | 'oscuro'

export function aplicarTema(t: Tema) {
  const html = document.documentElement
  if (t === 'auto') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light')
  const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', oscuro ? 'dark' : 'light')
}

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem('lista-turno-tema')
    if (t === 'claro' || t === 'oscuro') return t
  } catch {
    /* sin almacenamiento */
  }
  return 'auto'
}

function BotonTema() {
  const [tema, setTema] = useState<Tema>(leerTema)
  const oscuroAhora = tema === 'oscuro' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <button
      className="btn btn-cabecera btn-tema"
      aria-label={oscuroAhora ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={() => {
        const nuevo: Tema = oscuroAhora ? 'claro' : 'oscuro'
        setTema(nuevo)
        aplicarTema(nuevo)
        try {
          localStorage.setItem('lista-turno-tema', nuevo)
        } catch {
          /* sin almacenamiento */
        }
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        {oscuroAhora ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
          </g>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
        )}
      </svg>
    </button>
  )
}
