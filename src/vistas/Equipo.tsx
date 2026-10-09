import { useState } from 'react'
import { rpc } from '../lib/supabase'
import { useTurno } from '../lib/turno'
import type { Empleado } from '../lib/tipos'
import { BotonDobleConfirmacion, useAviso } from '../componentes/ui'

const pinValido = (p: string) => /^[0-9]{4}$/.test(p)

function CampoPin({ valor, alCambiar, etiqueta }: { valor: string; alCambiar: (v: string) => void; etiqueta: string }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]{4}"
        maxLength={4}
        placeholder="4 dígitos"
        value={valor}
        onChange={(e) => alCambiar(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="mono"
      />
    </label>
  )
}

export function Equipo() {
  const { empleados, perfil, recargar } = useTurno()
  const avisar = useAviso()
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (!perfil.admin) {
    return (
      <div className="vista">
        <h1 className="titulo-vista">Equipo</h1>
        <p className="nota">Solo el administrador puede gestionar el equipo.</p>
      </div>
    )
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !pinValido(pin)) return
    setOcupado(true)
    try {
      await rpc('crear_empleado', { p_nombre: nombre, p_pin: pin })
      await recargar('empleados')
      avisar(`${nombre.trim()} se unió al equipo`)
      setNombre('')
      setPin('')
    } catch (err) {
      avisar((err as Error).message, 'error')
    } finally {
      setOcupado(false)
    }
  }

  const activos = empleados.filter((e) => e.activo)

  return (
    <div className="vista">
      <h1 className="titulo-vista">Equipo</h1>
      <p className="descripcion">Cada persona entra tocando su nombre y escribiendo su PIN de 4 dígitos.</p>

      <section className="ticket" aria-labelledby="nuevo">
        <header className="ticket-cabeza">
          <h2 id="nuevo" className="ticket-titulo">
            Agregar empleado
          </h2>
        </header>
        <form className="formulario ticket-cuerpo" onSubmit={crear}>
          <label className="campo">
            <span>Nombre</span>
            <input value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
          </label>
          <CampoPin etiqueta="PIN" valor={pin} alCambiar={setPin} />
          <button className="btn btn-primario" disabled={ocupado || !nombre.trim() || !pinValido(pin)}>
            {ocupado ? 'Agregando…' : 'Agregar al equipo'}
          </button>
        </form>
      </section>

      <section className="ticket" aria-labelledby="lista-equipo">
        <header className="ticket-cabeza">
          <h2 id="lista-equipo" className="ticket-titulo">
            En el equipo
          </h2>
          <span className="ticket-contador mono">{activos.length}</span>
        </header>
        {activos.length === 0 && <p className="ticket-vacio">Todavía no hay nadie.</p>}
        <ul className="lista-equipo">
          {activos.map((e) => (
            <FilaEmpleado key={e.id} empleado={e} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function FilaEmpleado({ empleado }: { empleado: Empleado }) {
  const { recargar } = useTurno()
  const avisar = useAviso()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(empleado.nombre)
  const [pin, setPin] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || (pin && !pinValido(pin))) return
    setOcupado(true)
    try {
      await rpc('actualizar_empleado', { p_id: empleado.id, p_nombre: nombre, p_pin: pin || null })
      await recargar('empleados')
      avisar(pin ? `PIN de ${nombre.trim()} cambiado. Debe volver a entrar.` : 'Cambios guardados')
      setPin('')
      setAbierto(false)
    } catch (err) {
      avisar((err as Error).message, 'error')
    } finally {
      setOcupado(false)
    }
  }

  async function quitar() {
    try {
      await rpc('quitar_empleado', { p_id: empleado.id })
      await recargar('empleados')
      avisar(`${empleado.nombre} ya no está en el equipo. Su historial se conserva.`)
    } catch (err) {
      avisar((err as Error).message, 'error')
    }
  }

  return (
    <li className="fila-empleado">
      <div className="fila-empleado-linea">
        <span className="inicial" aria-hidden="true">
          {empleado.nombre.charAt(0).toUpperCase()}
        </span>
        <span className="persona">{empleado.nombre}</span>
        <button
          className="btn btn-secundario"
          aria-expanded={abierto}
          onClick={() => {
            setAbierto((v) => !v)
            setNombre(empleado.nombre)
            setPin('')
          }}
        >
          {abierto ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {abierto && (
        <div className="fila-empleado-edicion">
          <form className="formulario" onSubmit={guardar}>
            <label className="campo">
              <span>Nombre</span>
              <input value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <CampoPin etiqueta="Nuevo PIN (opcional, para cambiarlo o restablecerlo)" valor={pin} alCambiar={setPin} />
            <button className="btn btn-primario" disabled={ocupado || !nombre.trim() || (!!pin && !pinValido(pin))}>
              {ocupado ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
          <BotonDobleConfirmacion
            etiqueta="Quitar"
            pregunta={`¿Quitar a ${empleado.nombre} del equipo?`}
            confirmacion="¿Seguro? Ya no podrá entrar. Su nombre se conserva en el historial."
            alConfirmar={quitar}
          />
        </div>
      )}
    </li>
  )
}
