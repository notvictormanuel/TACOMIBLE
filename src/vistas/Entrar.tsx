import { useCallback, useEffect, useState } from 'react'
import { rpc, supabase, traducirError } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'
import { Cargando } from '../componentes/ui'

interface Props {
  aviso?: string | null
  alEntrar: (p: Perfil) => void
}

export function Entrar({ aviso, alEntrar }: Props) {
  const [modo, setModo] = useState<'empleado' | 'admin'>('empleado')
  return (
    <div className="entrar">
      <div className="entrar-marca">
        <Logo />
        <h1 className="entrar-titulo">Lista de Turno</h1>
        <p className="entrar-sub">La cocina, puesto por puesto.</p>
      </div>
      <div className="filete" aria-hidden="true" />
      <main className="entrar-cuerpo">
        {aviso && <p className="nota nota-alerta">{aviso}</p>}
        {modo === 'empleado' ? (
          <EntrarEmpleado alEntrar={alEntrar} alAdmin={() => setModo('admin')} />
        ) : (
          <EntrarAdmin alEntrar={alEntrar} alVolver={() => setModo('empleado')} />
        )}
      </main>
    </div>
  )
}

export function Logo({ tam = 64 }: { tam?: number }) {
  return <img src="/icons/icono.svg" width={tam} height={tam} alt="" className="logo" />
}

function EntrarEmpleado({ alEntrar, alAdmin }: { alEntrar: (p: Perfil) => void; alAdmin: () => void }) {
  const [lista, setLista] = useState<{ id: string; nombre: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegido, setElegido] = useState<{ id: string; nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      setLista(await rpc<{ id: string; nombre: string }[]>('lista_empleados_login'))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (elegido) {
    return <TecladoPin empleado={elegido} alVolver={() => setElegido(null)} alEntrar={alEntrar} />
  }

  return (
    <section aria-labelledby="quien">
      <h2 id="quien" className="titulo-seccion">
        ¿Quién eres?
      </h2>
      <p className="texto-guia">Toca tu nombre y escribe tu PIN de 4 dígitos.</p>
      {error && (
        <div className="nota nota-alerta">
          <p>{error}</p>
          <button className="btn btn-secundario" onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}
      {!lista && !error && <Cargando />}
      {lista && lista.length === 0 && (
        <p className="nota">Todavía no hay empleados. El administrador debe crearlos en la pestaña Equipo.</p>
      )}
      {lista && (
        <ul className="lista-nombres">
          {lista.map((e) => (
            <li key={e.id}>
              <button className="btn-nombre" onClick={() => setElegido(e)}>
                <span className="inicial" aria-hidden="true">
                  {e.nombre.charAt(0).toUpperCase()}
                </span>
                {e.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-enlace" onClick={alAdmin}>
        Soy el administrador
      </button>
    </section>
  )
}

function TecladoPin({
  empleado,
  alVolver,
  alEntrar,
}: {
  empleado: { id: string; nombre: string }
  alVolver: () => void
  alEntrar: (p: Perfil) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = useCallback(
    async (valor: string) => {
      setOcupado(true)
      setError(null)
      try {
        // Cada celular usa una sesión anónima de Supabase que se vincula al empleado con el PIN.
        const { data } = await supabase.auth.getSession()
        if (!data.session || !data.session.user.is_anonymous) {
          if (data.session) await supabase.auth.signOut()
          const { error } = await supabase.auth.signInAnonymously()
          if (error) throw new Error(traducirError(error.message))
        }
        const r = await rpc<{ ok: boolean; error?: string }>('iniciar_sesion_empleado', {
          p_empleado_id: empleado.id,
          p_pin: valor,
        })
        if (!r.ok) {
          setError(r.error ?? 'No se pudo entrar.')
          setPin('')
          return
        }
        alEntrar(await rpc<Perfil>('mi_perfil'))
      } catch (e) {
        setError((e as Error).message)
        setPin('')
      } finally {
        setOcupado(false)
      }
    },
    [empleado.id, alEntrar],
  )

  const pulsar = useCallback(
    (d: string) => {
      if (ocupado || pin.length >= 4) return
      setError(null)
      const nuevo = pin + d
      setPin(nuevo)
      if (nuevo.length === 4) enviar(nuevo)
    },
    [ocupado, pin, enviar],
  )
  const borrar = useCallback(() => setPin((p) => p.slice(0, -1)), [])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pulsar(e.key)
      else if (e.key === 'Backspace') borrar()
      else if (e.key === 'Escape') alVolver()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [pulsar, borrar, alVolver])

  return (
    <section className="pin" aria-labelledby="pin-titulo">
      <h2 id="pin-titulo" className="titulo-seccion">
        Hola, {empleado.nombre}
      </h2>
      <p className="texto-guia">Escribe tu PIN</p>
      <div className={`pin-puntos${error ? ' pin-error' : ''}`} aria-label={`${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-punto${i < pin.length ? ' lleno' : ''}`} />
        ))}
      </div>
      <p className="pin-mensaje" role="alert">
        {ocupado ? 'Verificando…' : error}
      </p>
      <div className="teclado">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="tecla" onClick={() => pulsar(d)} disabled={ocupado}>
            {d}
          </button>
        ))}
        <button className="tecla tecla-texto" onClick={alVolver}>
          Volver
        </button>
        <button className="tecla" onClick={() => pulsar('0')} disabled={ocupado}>
          0
        </button>
        <button className="tecla tecla-texto" onClick={borrar} disabled={ocupado} aria-label="Borrar">
          Borrar
        </button>
      </div>
    </section>
  )
}

function EntrarAdmin({ alEntrar, alVolver }: { alEntrar: (p: Perfil) => void; alVolver: () => void }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
      if (error) throw new Error(traducirError(error.message))
      const p = await rpc<Perfil>('mi_perfil')
      if (!p.admin) {
        await supabase.auth.signOut()
        throw new Error('Esta cuenta no tiene permisos de administrador.')
      }
      alEntrar(p)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="admin-titulo">
      <h2 id="admin-titulo" className="titulo-seccion">
        Administrador
      </h2>
      <form className="formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>
        {error && (
          <p className="nota nota-alerta" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
        <button type="button" className="btn btn-enlace" onClick={alVolver}>
          Soy empleado
        </button>
      </form>
    </section>
  )
}
