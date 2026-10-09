import { useState } from 'react'
import { rpc } from '../lib/supabase'
import { useTurno } from '../lib/turno'
import { hora } from '../lib/fecha'
import { BLOQUES, ROLES, type Bloque, type Marca, type Rol, type Tarea } from '../lib/tipos'
import { Barra, BotonDobleConfirmacion, Contador, useAviso } from '../componentes/ui'

export function Puesto({ rol }: { rol: Rol }) {
  const { tareas, marcas, perfil, distribucion, asignadoA, nombreDe } = useTurno()
  const [editando, setEditando] = useState(false)
  const info = ROLES.find((r) => r.id === rol)!
  const asignado = asignadoA(rol)
  const nombre = nombreDe(asignado)
  const esMio = !!asignado && asignado.empleado_id === perfil.empleado_id
  // El empleado marca si el puesto es suyo hoy o si nadie lo cubre.
  const puedeMarcarPuesto = perfil.admin || !asignado || esMio

  const delRol = tareas.filter((t) => t.rol === rol)
  const marcaDe = new Map<string, Marca>()
  for (const m of marcas) if (!marcaDe.has(m.tarea_id) || m.empleado_id === perfil.empleado_id) marcaDe.set(m.tarea_id, m)
  const hechas = delRol.filter((t) => marcaDe.has(t.id)).length

  return (
    <div className={`vista rol-${rol}`}>
      <div className="cabeza-puesto">
        <span className="cabeza-puesto-banda" aria-hidden="true" />
        <h1 className="titulo-vista">{info.nombre}</h1>
        <p className="descripcion">{info.descripcion}</p>
        <p className="hoy-puesto">
          Hoy en este puesto:{' '}
          <strong className={nombre ? '' : 'vacia'}>
            {nombre ? (esMio ? `${nombre} (tú)` : nombre) : 'Sin asignar'}
          </strong>
          {nombre && distribucion.estado === 'heredada' && <span className="chip chip-borde">sin confirmar</span>}
        </p>
        <Barra hechas={hechas} total={delRol.length} />
        <Contador hechas={hechas} total={delRol.length} />
        {!puedeMarcarPuesto && (
          <p className="nota">Solo {nombre} marca las tareas de este puesto hoy. Tú puedes verlas y agregar tareas.</p>
        )}
        {perfil.admin && (
          <button
            className={`btn ${editando ? 'btn-primario' : 'btn-secundario'} btn-editar-lista`}
            onClick={() => setEditando((v) => !v)}
            aria-pressed={editando}
          >
            {editando ? 'Listo, terminar de editar' : 'Editar o quitar tareas'}
          </button>
        )}
      </div>

      {BLOQUES.map((b, i) => (
        <Ticket
          key={b.id}
          numero={i + 1}
          rol={rol}
          bloque={b.id}
          titulo={b.nombre}
          tareas={delRol.filter((t) => t.bloque === b.id)}
          marcaDe={marcaDe}
          puedeMarcarPuesto={puedeMarcarPuesto}
          editando={editando}
        />
      ))}
    </div>
  )
}

function Ticket({
  numero,
  rol,
  bloque,
  titulo,
  tareas,
  marcaDe,
  puedeMarcarPuesto,
  editando,
}: {
  numero: number
  rol: Rol
  bloque: Bloque
  titulo: string
  tareas: Tarea[]
  marcaDe: Map<string, Marca>
  puedeMarcarPuesto: boolean
  editando: boolean
}) {
  const hechas = tareas.filter((t) => marcaDe.has(t.id)).length
  const completo = tareas.length > 0 && hechas === tareas.length
  return (
    <section className={`ticket${completo ? ' ticket-completo' : ''}`} aria-labelledby={`b-${bloque}`}>
      <header className="ticket-cabeza">
        <span className="ticket-num mono" aria-hidden="true">
          #{String(numero).padStart(2, '0')}
        </span>
        <h2 id={`b-${bloque}`} className="ticket-titulo">
          {titulo}
        </h2>
        <span className="ticket-contador mono" aria-label={`${hechas} de ${tareas.length} hechas`}>
          {hechas}/{tareas.length}
        </span>
      </header>
      {tareas.length === 0 && <p className="ticket-vacio">No hay tareas en este bloque.</p>}
      <ul className="lista-tareas">
        {tareas.map((t) => (
          <FilaTarea
            key={t.id}
            tarea={t}
            marca={marcaDe.get(t.id)}
            puedeMarcarPuesto={puedeMarcarPuesto}
            editando={editando}
          />
        ))}
      </ul>
      <AgregarTarea rol={rol} bloque={bloque} titulo={titulo} />
    </section>
  )
}

function FilaTarea({
  tarea,
  marca,
  puedeMarcarPuesto,
  editando,
}: {
  tarea: Tarea
  marca: Marca | undefined
  puedeMarcarPuesto: boolean
  editando: boolean
}) {
  const { perfil, recargar } = useTurno()
  const avisar = useAviso()
  const [optimista, setOptimista] = useState<boolean | null>(null)
  const [editTexto, setEditTexto] = useState<string | null>(null)

  const hecha = optimista ?? !!marca
  const deOtro = !!marca && !perfil.admin && marca.empleado_id !== perfil.empleado_id
  const habilitado = puedeMarcarPuesto && !deOtro

  async function alternar() {
    if (!habilitado) return
    const nuevo = !hecha
    setOptimista(nuevo)
    try {
      await rpc('marcar_tarea', { p_tarea_id: tarea.id, p_hecha: nuevo })
      await recargar('marcas')
    } catch (e) {
      avisar((e as Error).message, 'error')
      await recargar('marcas')
    } finally {
      setOptimista(null)
    }
  }

  async function guardarTexto() {
    if (!editTexto?.trim()) return
    try {
      await rpc('editar_tarea', { p_id: tarea.id, p_texto: editTexto })
      await recargar('tareas')
      setEditTexto(null)
      avisar('Tarea actualizada')
    } catch (e) {
      avisar((e as Error).message, 'error')
    }
  }

  async function quitar() {
    try {
      await rpc('quitar_tarea', { p_id: tarea.id })
      await recargar('tareas')
      avisar('Tarea quitada')
    } catch (e) {
      avisar((e as Error).message, 'error')
    }
  }

  return (
    <li className="fila-tarea">
      {editTexto !== null ? (
        <form
          className="form-linea"
          onSubmit={(e) => {
            e.preventDefault()
            guardarTexto()
          }}
        >
          <input
            aria-label="Texto de la tarea"
            value={editTexto}
            maxLength={200}
            onChange={(e) => setEditTexto(e.target.value)}
            autoFocus
          />
          <div className="fila-botones">
            <button className="btn btn-primario">Guardar</button>
            <button type="button" className="btn btn-secundario" onClick={() => setEditTexto(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={hecha}
          aria-disabled={!habilitado}
          className={`check${hecha ? ' check-hecha' : ''}${habilitado ? '' : ' check-bloqueada'}`}
          onClick={alternar}
        >
          <span className="check-caja" aria-hidden="true">
            {hecha && (
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
              </svg>
            )}
          </span>
          <span className="check-texto">
            <span className="check-tarea">{tarea.texto}</span>
            {marca && hecha && (
              <span className="check-meta">
                <span className="mono">{hora(marca.hora)}</span>
                {marca.empleado_id !== perfil.empleado_id || perfil.admin ? ` · ${marca.nombre}` : ''}
              </span>
            )}
            {optimista === true && !marca && <span className="check-meta">Guardando…</span>}
          </span>
        </button>
      )}
      {editando && editTexto === null && (
        <div className="acciones-tarea">
          <button type="button" className="btn btn-secundario" onClick={() => setEditTexto(tarea.texto)}>
            Editar
          </button>
          <BotonDobleConfirmacion
            etiqueta="Quitar"
            pregunta={`¿Quitar "${tarea.texto}"?`}
            confirmacion="¿Seguro? Se quita de la lista para todos desde hoy."
            alConfirmar={quitar}
          />
        </div>
      )}
    </li>
  )
}

function AgregarTarea({ rol, bloque, titulo }: { rol: Rol; bloque: Bloque; titulo: string }) {
  const { recargar } = useTurno()
  const avisar = useAviso()
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setOcupado(true)
    try {
      await rpc('agregar_tarea', { p_rol: rol, p_bloque: bloque, p_texto: texto })
      await recargar('tareas')
      setTexto('')
      avisar('Tarea agregada')
    } catch (err) {
      avisar((err as Error).message, 'error')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="agregar-tarea" onSubmit={agregar}>
      <input
        aria-label={`Agregar tarea a ${titulo}`}
        placeholder="Agregar tarea"
        value={texto}
        maxLength={200}
        onChange={(e) => setTexto(e.target.value)}
        enterKeyHint="done"
      />
      <button className="btn btn-primario" disabled={ocupado || !texto.trim()}>
        Agregar
      </button>
    </form>
  )
}
