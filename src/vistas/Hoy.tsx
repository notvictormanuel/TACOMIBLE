import { useTurno } from '../lib/turno'
import { fechaLarga } from '../lib/fecha'
import { ROLES } from '../lib/tipos'
import { TarjetaDistribucion } from '../componentes/Distribucion'
import { Barra, Contador } from '../componentes/ui'

export function Hoy({ irA }: { irA: (ruta: string) => void }) {
  const { hoy, tareas, marcas, asignadoA, nombreDe, perfil } = useTurno()

  return (
    <div className="vista">
      <p className="sobretitulo">Hoy</p>
      <h1 className="titulo-vista">{fechaLarga(hoy)}</h1>

      <TarjetaDistribucion />

      <h2 className="titulo-seccion">Avance por puesto</h2>
      <div className="rejilla-puestos">
        {ROLES.map((r) => {
          const ids = new Set(tareas.filter((t) => t.rol === r.id).map((t) => t.id))
          const hechas = new Set(marcas.filter((m) => ids.has(m.tarea_id)).map((m) => m.tarea_id)).size
          const a = asignadoA(r.id)
          const nombre = nombreDe(a)
          const mio = a && a.empleado_id === perfil.empleado_id
          return (
            <button key={r.id} className={`tarjeta-puesto rol-${r.id}`} onClick={() => irA(r.id)}>
              <span className="tarjeta-puesto-banda" aria-hidden="true" />
              <span className="tarjeta-puesto-cabeza">
                <span className="tarjeta-puesto-nombre">{r.nombre}</span>
                {mio && <span className="chip">Tu puesto</span>}
              </span>
              <span className={nombre ? 'persona' : 'persona vacia'}>{nombre ?? 'Sin asignar'}</span>
              <Barra hechas={hechas} total={ids.size} etiqueta={`${r.nombre}: ${hechas} de ${ids.size} hechas`} />
              <Contador hechas={hechas} total={ids.size} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
