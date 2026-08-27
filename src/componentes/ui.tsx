import { useEffect, useRef, type ReactNode } from 'react'

/** Pila de modales abiertos: Escape solo debe cerrar el de hasta arriba. */
const pilaModales: symbol[] = []

/* ---------------------------------------------------------------- */

export function Modal({
  titulo,
  subtitulo,
  ancho,
  onCerrar,
  pie,
  children,
}: {
  titulo: string
  subtitulo?: string
  ancho?: boolean
  onCerrar: () => void
  pie?: ReactNode
  children: ReactNode
}) {
  const marca = useRef(Symbol('modal'))

  useEffect(() => {
    const propia = marca.current
    pilaModales.push(propia)
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pilaModales[pilaModales.length - 1] === propia) onCerrar()
    }
    document.addEventListener('keydown', alPresionar)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      const i = pilaModales.indexOf(propia)
      if (i >= 0) pilaModales.splice(i, 1)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={ancho ? 'modal ancho' : 'modal'} role="dialog" aria-modal="true">
        <div className="modal-cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="mini tenue">{subtitulo}</p>}
          </div>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function Metrica({
  etiqueta,
  valor,
  pie,
  tono,
  destacada,
  ayuda,
  mediana,
}: {
  etiqueta: string
  valor: ReactNode
  pie?: ReactNode
  tono?: 'pos' | 'neg' | null
  destacada?: boolean
  ayuda?: string
  mediana?: boolean
}) {
  return (
    <div className={destacada ? 'metrica destacada' : 'metrica'}>
      <div className="metrica-etiqueta">
        {etiqueta}
        {ayuda && (
          <span title={ayuda} style={{ cursor: 'help', opacity: 0.6 }}>
            ⓘ
          </span>
        )}
      </div>
      <div className={`metrica-valor${mediana ? ' mediana' : ''} ${tono ?? ''}`}>{valor}</div>
      {pie && <div className="metrica-pie">{pie}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T
  opciones: Array<{ id: T; etiqueta: string }>
  onCambio: (id: T) => void
}) {
  return (
    <div className="segmentado" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={o.id === valor}
          className={o.id === valor ? 'activo' : ''}
          onClick={() => onCambio(o.id)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function Vacio({
  icono = '📭',
  titulo,
  texto,
  accion,
}: {
  icono?: string
  titulo: string
  texto?: string
  accion?: ReactNode
}) {
  return (
    <div className="vacio">
      <div className="vacio-icono">{icono}</div>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function BarraProgreso({
  valor,
  color,
  fondo,
}: {
  valor: number
  color?: string
  fondo?: string
}) {
  const ancho = Math.max(0, Math.min(100, valor))
  return (
    <div className="barra-progreso" style={fondo ? { background: fondo } : undefined}>
      <span style={{ width: `${ancho}%`, background: color ?? 'var(--acento)' }} />
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function Confirmar({
  titulo,
  mensaje,
  textoConfirmar = 'Si, borrar',
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  mensaje: string
  textoConfirmar?: string
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCancelar}
      pie={
        <>
          <button className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn peligro" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p className="tenue">{mensaje}</p>
    </Modal>
  )
}
