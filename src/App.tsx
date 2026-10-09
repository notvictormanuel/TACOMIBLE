import { useCallback, useEffect, useState } from 'react'
import { configurado, rpc, supabase } from './lib/supabase'
import { TurnoProvider } from './lib/turno'
import type { Perfil } from './lib/tipos'
import { Entrar } from './vistas/Entrar'
import { Turno } from './vistas/Turno'
import { Cargando } from './componentes/ui'

type Estado = { fase: 'cargando' } | { fase: 'entrar'; aviso?: string } | { fase: 'dentro'; perfil: Perfil } | { fase: 'sin-red' }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })

  const revisar = useCallback(async () => {
    setEstado({ fase: 'cargando' })
    const { data } = await supabase.auth.getSession()
    if (!data.session) return setEstado({ fase: 'entrar' })
    try {
      const p = await rpc<Perfil>('mi_perfil')
      setEstado(p.admin || p.empleado_id ? { fase: 'dentro', perfil: p } : { fase: 'entrar' })
    } catch (e) {
      setEstado(/conexión/.test((e as Error).message) ? { fase: 'sin-red' } : { fase: 'entrar' })
    }
  }, [])

  useEffect(() => {
    if (!configurado) return
    revisar()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') setEstado({ fase: 'entrar' })
    })
    return () => data.subscription.unsubscribe()
  }, [revisar])

  const salir = useCallback(async () => {
    if (estado.fase === 'dentro' && estado.perfil.admin) {
      await supabase.auth.signOut()
    } else {
      // El empleado deja libre el celular; la sesión anónima se reutiliza en el próximo ingreso.
      try {
        await rpc('cerrar_sesion_empleado')
      } catch {
        await supabase.auth.signOut()
      }
    }
    window.location.hash = ''
    setEstado({ fase: 'entrar' })
  }, [estado])

  const perderAcceso = useCallback(() => {
    setEstado({ fase: 'entrar', aviso: 'Tu sesión se cerró. Vuelve a entrar con tu PIN.' })
  }, [])

  if (!configurado) {
    return (
      <div className="pantalla-centro">
        <h1 className="titulo-vista">Falta configurar Supabase</h1>
        <p>
          Crea un archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Mira
          el README.
        </p>
      </div>
    )
  }

  switch (estado.fase) {
    case 'cargando':
      return (
        <div className="pantalla-centro">
          <Cargando />
        </div>
      )
    case 'sin-red':
      return (
        <div className="pantalla-centro">
          <h1 className="titulo-vista">Sin conexión</h1>
          <p>Revisa el internet del celular.</p>
          <button className="btn btn-primario" onClick={revisar}>
            Reintentar
          </button>
        </div>
      )
    case 'entrar':
      return <Entrar aviso={estado.aviso} alEntrar={(perfil) => setEstado({ fase: 'dentro', perfil })} />
    case 'dentro':
      return (
        <TurnoProvider perfil={estado.perfil} alPerderAcceso={perderAcceso}>
          <Turno alSalir={salir} />
        </TurnoProvider>
      )
  }
}
