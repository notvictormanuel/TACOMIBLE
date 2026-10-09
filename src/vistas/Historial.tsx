import { useCallback, useEffect, useState } from 'react'
import { rpc, supabase, traducirError } from '../lib/supabase'
import { useTurno } from '../lib/turno'
import { fechaDe, fechaMedia, hora, restarDias } from '../lib/fecha'
import { ROLES, type Asignacion, type Rol } from '../lib/tipos'
import { Barra, Cargando } from '../componentes/ui'
import { EditorDistribucion } from '../componentes/Distribucion'

const DIAS_POR_PAGINA = 45

interface Dia {
  fecha: string
  asignacion: Asignacion | null
  avance: Record<Rol, { total: number; hechas: number }>
}

export function Historial() {
  const { hoy, version, nombreDe, asignadoA, perfil } = useTurno()
  const [dias, setDias] = useState<Dia[] | null>(null)
  const [paginas, setPaginas] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)

  const desde = restarDias(hoy, DIAS_POR_PAGINA * paginas - 1)

  const cargar = useCallback(async () => {
    try {
      const [resumen, asig] = await Promise.all([
        rpc<{ fecha: string; rol: Rol; total: number; hechas: number }[]>('resumen_historial', {
          p_desde: desde,
          p_hasta: hoy,
        }),
        supabase
          .from('asignaciones')
          .select('fecha, roles, definido_por, definido_en')
          .gte('fecha', desde)
          .lte('fecha', hoy)
          .order('fecha', { ascending: false }),
      ])
      if (asig.error) throw new Error(traducirError(asig.error.message))
      const porFecha = new Map<string, Dia>()
      for (const fila of resumen) {
        let d = porFecha.get(fila.fecha)
        if (!d) {
          d = { fecha: fila.fecha, asignacion: null, avance: {} as Dia['avance'] }
          porFecha.set(fila.fecha, d)
        }
        d.avance[fila.rol] = { total: fila.total, hechas: fila.hechas }
      }
      for (const a of asig.data as Asignacion[]) {
        porFecha.get(a.fecha)!.asignacion = a
      }
      setDias([...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [desde, hoy])

  useEffect(() => {
    cargar()
  }, [cargar, version])

  return (
    <div className="vista">
      <h1 className="titulo-vista">Historial</h1>
      <p className="descripcion">Toca un día para ver el avance de cada puesto.</p>
      {error && <p className="nota nota-alerta">{error}</p>}
      {!dias && !error && <Cargando />}
      {dias && dias.length === 0 && <p className="nota">Todavía no hay días guardados.</p>}
      <ol className="lista-dias">
        {dias?.map((d) => {
          const esHoy = d.fecha === hoy
          // Hoy sin confirmar se muestra con la distribución heredada.
          const quien = (rol: Rol) =>
            d.asignacion ? nombreDe(d.asignacion.roles?.[rol]) : esHoy ? nombreDe(asignadoA(rol)) : null
          const estaAbierto = abierto === d.fecha
          return (
            <li key={d.fecha} className={`ticket dia${estaAbierto ? ' dia-abierto' : ''}`}>
              <button
                className="dia-cabeza"
                aria-expanded={estaAbierto}
                onClick={() => {
                  setAbierto(estaAbierto ? null : d.fecha)
                  setEditando(null)
                }}
              >
                <span className="dia-fecha">
                  {esHoy ? 'Hoy · ' : ''}
                  {fechaMedia(d.fecha)}
                </span>
                <span className="dia-resumen">
                  {ROLES.map((r) => (
                    <span key={r.id} className="dia-par">
                      {r.nombre}: <strong>{quien(r.id) ?? '—'}</strong>
                    </span>
                  ))}
                </span>
                <span className="dia-flecha" aria-hidden="true">
                  {estaAbierto ? '▲' : '▼'}
                </span>
              </button>
              {estaAbierto && (
                <div className="dia-detalle">
                  {editando === d.fecha ? (
                    <EditorDistribucion
                      fecha={d.fecha}
                      inicial={d.asignacion}
                      alTerminar={() => {
                        setEditando(null)
                        cargar()
                      }}
                    />
                  ) : (
                    <>
                      <ul className="dia-roles">
                        {ROLES.map((r) => {
                          const av = d.avance[r.id] ?? { total: 0, hechas: 0 }
                          return (
                            <li key={r.id} className="dia-rol">
                              <div className="dia-rol-linea">
                                <span className={`etiqueta-rol rol-${r.id}`}>{r.nombre}</span>
                                <span className={quien(r.id) ? 'persona' : 'persona vacia'}>
                                  {quien(r.id) ?? 'Sin asignar'}
                                </span>
                              </div>
                              <Barra hechas={av.hechas} total={av.total} etiqueta={`${r.nombre}: ${av.hechas} de ${av.total} tareas`} />
                              <span className="mono">
                                {av.hechas} de {av.total} tareas
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                      <p className="dia-definido">
                        {d.asignacion ? (
                          <>
                            Distribución definida por <strong>{d.asignacion.definido_por}</strong>
                            {fechaDe(d.asignacion.definido_en) === d.fecha
                              ? ' ese día'
                              : ` el ${fechaMedia(fechaDe(d.asignacion.definido_en))}`}{' '}
                            a las <span className="mono">{hora(d.asignacion.definido_en)}</span>
                          </>
                        ) : (
                          'Distribución sin confirmar este día.'
                        )}
                      </p>
                      {perfil.admin && (
                        <button className="btn btn-secundario" onClick={() => setEditando(d.fecha)}>
                          Editar distribución de este día
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {dias && dias.length > 0 && (
        <button className="btn btn-secundario btn-ancho" onClick={() => setPaginas((p) => p + 1)}>
          Ver días anteriores
        </button>
      )}
    </div>
  )
}
