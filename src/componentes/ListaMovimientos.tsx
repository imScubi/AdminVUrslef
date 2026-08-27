import { useMemo, useState } from 'react'
import type { Movimiento } from '../tipos'
import { ETIQUETA_MOVIMIENTO } from '../tipos'
import { useTienda } from '../estado/tienda'
import { dinero } from '../lib/formato'
import { fechaRelativa } from '../lib/fechas'
import { Confirmar, Vacio } from './ui'
import { FormMovimiento } from './FormMovimiento'

const ICONO: Record<string, { emoji: string; fondo: string; color: string }> = {
  venta: { emoji: '💰', fondo: 'var(--verde-suave)', color: 'var(--verde)' },
  gasto: { emoji: '🧾', fondo: 'var(--rojo-suave)', color: 'var(--rojo)' },
  retiro: { emoji: '🏦', fondo: 'var(--ambar-suave)', color: 'var(--ambar)' },
  aporte: { emoji: '➕', fondo: 'var(--azul-suave)', color: 'var(--azul)' },
  traspaso: { emoji: '🔁', fondo: 'var(--morado-suave)', color: 'var(--morado)' },
  ajuste: { emoji: '⚖️', fondo: 'var(--superficie-3)', color: 'var(--texto-2)' },
}

/** Cuanto suma o resta el movimiento visto desde un origen (o desde el total). */
export function efectoEnCaja(m: Movimiento, origenId?: string): number {
  switch (m.tipo) {
    case 'venta':
    case 'aporte':
      return m.monto
    case 'gasto':
    case 'retiro':
      return -m.monto
    case 'ajuste':
      return m.monto
    case 'traspaso':
      if (!origenId) return 0
      return m.destinoId === origenId ? m.monto : -m.monto
  }
}

export function ListaMovimientos({
  movimientos,
  origenId,
  mostrarOrigen = true,
  limite,
  vacioTexto = 'Todavia no hay movimientos aqui.',
}: {
  movimientos: Movimiento[]
  origenId?: string
  mostrarOrigen?: boolean
  limite?: number
  vacioTexto?: string
}) {
  const { db, borrarMovimiento } = useTienda()
  const [editando, setEditando] = useState<Movimiento | null>(null)
  const [borrando, setBorrando] = useState<Movimiento | null>(null)

  const [mostrar, setMostrar] = useState(limite ?? 40)

  const todos = useMemo(
    () =>
      [...movimientos].sort((a, b) =>
        a.fecha === b.fecha ? b.creadoEn.localeCompare(a.creadoEn) : b.fecha.localeCompare(a.fecha),
      ),
    [movimientos],
  )
  const ordenados = todos.slice(0, mostrar)
  const restantes = todos.length - ordenados.length

  if (!todos.length) {
    return <Vacio icono="🗂️" titulo="Sin movimientos" texto={vacioTexto} />
  }

  // Ids que abren un nuevo grupo de fecha en la lista.
  const inicioDeGrupo = new Set<string>()
  ordenados.forEach((m, i) => {
    if (i === 0 || ordenados[i - 1].fecha !== m.fecha) inicioDeGrupo.add(m.id)
  })

  return (
    <div>
      {ordenados.map((m) => {
        const origen = db.origenes.find((o) => o.id === m.origenId)
        const destino = m.destinoId ? db.origenes.find((o) => o.id === m.destinoId) : undefined
        const cat = db.categorias.find((c) => c.id === m.categoria)
        const efecto = efectoEnCaja(m, origenId ?? m.origenId)
        const estilo = ICONO[m.tipo]
        const encabezado = inicioDeGrupo.has(m.id)

        const ganancia =
          m.tipo === 'venta' && m.costo != null ? m.monto - m.costo : null

        return (
          <div key={m.id}>
            {encabezado && (
              <div
                className="mini tenue-2"
                style={{
                  padding: '10px 14px 4px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.68rem',
                }}
              >
                {fechaRelativa(m.fecha)}
              </div>
            )}
            <div className="movimiento">
              <div
                className="mov-icono"
                style={{ background: estilo.fondo, color: estilo.color }}
                title={ETIQUETA_MOVIMIENTO[m.tipo]}
              >
                {estilo.emoji}
              </div>
              <div className="mov-cuerpo">
                <div className="mov-concepto">{m.concepto || ETIQUETA_MOVIMIENTO[m.tipo]}</div>
                <div className="mov-meta">
                  {mostrarOrigen && origen && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <i className="punto" style={{ background: origen.color }} />
                      {origen.nombre}
                    </span>
                  )}
                  {destino && <span>→ {destino.nombre}</span>}
                  {cat && <span className="pill">{cat.nombre}</span>}
                  {ganancia !== null && (
                    <span className={ganancia >= 0 ? 'pos' : 'neg'}>
                      deja {dinero(ganancia, 0)}
                    </span>
                  )}
                  {m.nota && <span title={m.nota}>📝</span>}
                </div>
              </div>
              <div className="mov-monto">
                <div className={efecto > 0 ? 'pos' : efecto < 0 ? 'neg' : 'tenue'}>
                  {efecto > 0 ? '+' : ''}
                  {dinero(efecto)}
                </div>
                {m.tipo === 'venta' && m.costo != null && (
                  <div className="mini tenue-2">costo {dinero(m.costo, 0)}</div>
                )}
              </div>
              <div className="mov-acciones">
                <button
                  className="btn chico fantasma"
                  onClick={() => setEditando(m)}
                  aria-label="Editar"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  className="btn chico fantasma"
                  onClick={() => setBorrando(m)}
                  aria-label="Borrar"
                  title="Borrar"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {restantes > 0 && (
        <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid var(--borde)' }}>
          <button className="btn chico" onClick={() => setMostrar((n) => n + 60)}>
            Ver {Math.min(restantes, 60)} mas ({restantes} pendientes)
          </button>
        </div>
      )}

      {editando && (
        <FormMovimiento movimiento={editando} onCerrar={() => setEditando(null)} />
      )}
      {borrando && (
        <Confirmar
          titulo="Borrar movimiento"
          mensaje={`Se va a borrar "${borrando.concepto}" por ${dinero(borrando.monto)}. Los saldos y las estadisticas se recalculan solos.`}
          onCancelar={() => setBorrando(null)}
          onConfirmar={() => {
            borrarMovimiento(borrando.id)
            setBorrando(null)
          }}
        />
      )}
    </div>
  )
}
