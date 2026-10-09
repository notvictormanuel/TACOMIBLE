import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

// ---------- Avisos ----------

interface Aviso {
  id: number
  texto: string
  tipo: 'ok' | 'error'
}

const AvisosCtx = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {})

export const useAviso = () => useContext(AvisosCtx)

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const sig = useRef(0)
  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = ++sig.current
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 5000 : 2800)
  }, [])
  return (
    <AvisosCtx.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  )
}

// ---------- Barra de avance ----------

export function Barra({ hechas, total, etiqueta }: { hechas: number; total: number; etiqueta?: string }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0
  return (
    <div
      className={`barra${pct === 100 ? ' barra-completa' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={hechas}
      aria-label={etiqueta ?? `${hechas} de ${total} hechas`}
    >
      <div className="barra-relleno" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Contador({ hechas, total }: { hechas: number; total: number }) {
  return (
    <span className="mono">
      {hechas} de {total} hechas
    </span>
  )
}

// ---------- Botón con doble confirmación ----------

export function BotonDobleConfirmacion({
  etiqueta,
  pregunta,
  confirmacion,
  alConfirmar,
}: {
  etiqueta: string
  pregunta: string
  confirmacion: string
  alConfirmar: () => Promise<void> | void
}) {
  const [paso, setPaso] = useState<0 | 1 | 2>(0)
  const [ocupado, setOcupado] = useState(false)

  if (paso === 0) {
    return (
      <button type="button" className="btn btn-quitar" onClick={() => setPaso(1)}>
        {etiqueta}
      </button>
    )
  }
  return (
    <div className="confirmar" role="alertdialog" aria-label={paso === 1 ? pregunta : confirmacion}>
      <p className="confirmar-texto">{paso === 1 ? pregunta : confirmacion}</p>
      <div className="fila-botones">
        {paso === 1 ? (
          <button type="button" className="btn btn-peligro" onClick={() => setPaso(2)}>
            Sí, {etiqueta.toLowerCase()}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-peligro"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true)
              try {
                await alConfirmar()
              } finally {
                setOcupado(false)
                setPaso(0)
              }
            }}
          >
            {ocupado ? 'Quitando…' : `${etiqueta} definitivamente`}
          </button>
        )}
        <button type="button" className="btn btn-secundario" onClick={() => setPaso(0)}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando-punto" />
      {texto}
    </div>
  )
}
