import { useState } from 'react'
import { rpc } from '../lib/supabase'
import { useTurno } from '../lib/turno'
import { fechaCorta, hora } from '../lib/fecha'
import { ROLES, type Asignacion, type Rol } from '../lib/tipos'
import { useAviso } from './ui'

/** Selector de una persona por puesto. Sirve para hoy y para corregir días del historial. */
export function EditorDistribucion({
  fecha,
  inicial,
  alTerminar,
}: {
  fecha: string
  inicial: Asignacion | null
  alTerminar: () => void
}) {
  const { empleados, hoy, recargar } = useTurno()
  const avisar = useAviso()
  const esHoy = fecha === hoy
  const [valores, setValores] = useState<Record<Rol, string>>(() => {
    const v = {} as Record<Rol, string>
    for (const r of ROLES) {
      const id = inicial?.roles?.[r.id]?.empleado_id ?? ''
      // Hoy solo se puede elegir gente activa.
      v[r.id] = !esHoy || empleados.some((e) => e.id === id && e.activo) ? id : ''
    }
    return v
  })
  const [ocupado, setOcupado] = useState(false)

  // En días pasados se puede volver a elegir a alguien que ya no está.
  const opciones = (rol: Rol) => {
    const activos = empleados.filter((e) => e.activo)
    const anterior = inicial?.roles?.[rol]
    if (!esHoy && anterior && !activos.some((e) => e.id === anterior.empleado_id)) {
      return [...activos, { id: anterior.empleado_id, nombre: `${anterior.nombre} (ya no está)`, activo: false }]
    }
    return activos
  }

  async function guardar() {
    setOcupado(true)
    try {
      const roles: Record<string, string | null> = {}
      for (const r of ROLES) roles[r.id] = valores[r.id] || null
      await rpc('guardar_distribucion', { p_roles: roles, p_fecha: fecha })
      await recargar('asignaciones')
      avisar(esHoy ? 'Distribución de hoy guardada' : `Distribución del ${fechaCorta(fecha)} guardada`)
      alTerminar()
    } catch (e) {
      avisar((e as Error).message, 'error')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="editor-dist">
      {ROLES.map((r) => (
        <label key={r.id} className="campo campo-rol">
          <span className={`etiqueta-rol rol-${r.id}`}>{r.nombre}</span>
          <select value={valores[r.id]} onChange={(e) => setValores((v) => ({ ...v, [r.id]: e.target.value }))}>
            <option value="">Sin asignar</option>
            {opciones(r.id).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="fila-botones">
        <button className="btn btn-primario" onClick={guardar} disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar distribución'}
        </button>
        <button className="btn btn-secundario" onClick={alTerminar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Tarjeta "Distribución de hoy". */
export function TarjetaDistribucion() {
  const { perfil, hoy, distribucion, asignadoA, nombreDe, empleados, recargar } = useTurno()
  const avisar = useAviso()
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const { estado, asignacion } = distribucion

  async function confirmar() {
    setOcupado(true)
    try {
      const roles: Record<string, string | null> = {}
      for (const r of ROLES) {
        const a = asignadoA(r.id)
        roles[r.id] = a && empleados.some((e) => e.id === a.empleado_id && e.activo) ? a.empleado_id : null
      }
      await rpc('guardar_distribucion', { p_roles: roles, p_fecha: hoy })
      await recargar('asignaciones')
      avisar('Distribución confirmada para hoy')
    } catch (e) {
      avisar((e as Error).message, 'error')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="ticket" aria-labelledby="dist-titulo">
      <header className="ticket-cabeza">
        <h2 id="dist-titulo" className="ticket-titulo">
          Distribución de hoy
        </h2>
      </header>

      <div className={`estado-dist estado-${estado}`}>
        {estado === 'confirmada' && asignacion && (
          <>
            <strong>Confirmada</strong> por {asignacion.definido_por} ·{' '}
            <span className="mono">{hora(asignacion.definido_en)}</span>
          </>
        )}
        {estado === 'heredada' && asignacion && (
          <>
            Igual que el <strong>{fechaCorta(asignacion.fecha)}</strong> · sin confirmar
          </>
        )}
        {estado === 'vacia' && <strong>Sin definir</strong>}
      </div>

      {editando ? (
        <EditorDistribucion fecha={hoy} inicial={asignacion} alTerminar={() => setEditando(false)} />
      ) : (
        <>
          <ul className="lista-dist">
            {ROLES.map((r) => {
              const nombre = nombreDe(asignadoA(r.id))
              return (
                <li key={r.id} className="fila-dist">
                  <span className={`etiqueta-rol rol-${r.id}`}>{r.nombre}</span>
                  <span className={nombre ? 'persona' : 'persona vacia'}>{nombre ?? 'Sin asignar'}</span>
                </li>
              )
            })}
          </ul>
          {perfil.admin && (
            <div className="fila-botones ticket-pie">
              {estado === 'heredada' && (
                <button className="btn btn-primario" onClick={confirmar} disabled={ocupado}>
                  {ocupado ? 'Confirmando…' : 'Confirmar para hoy'}
                </button>
              )}
              <button
                className={`btn ${estado === 'heredada' ? 'btn-secundario' : 'btn-primario'}`}
                onClick={() => setEditando(true)}
              >
                Editar distribución
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
