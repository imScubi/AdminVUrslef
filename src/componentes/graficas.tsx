import { useLayoutEffect, useRef, useState } from 'react'
import type { PuntoMes, RebanadaCategoria } from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { nombreMes } from '../lib/fechas'

/** Mide el ancho disponible para que las graficas se adapten al contenedor. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(600)
  useLayoutEffect(() => {
    const nodo = ref.current
    if (!nodo) return
    const observador = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect.width
      if (w && w > 0) setAncho(w)
    })
    observador.observe(nodo)
    setAncho(nodo.getBoundingClientRect().width || 600)
    return () => observador.disconnect()
  }, [])
  return [ref, ancho] as const
}

function escalaBonita(maximo: number): number {
  if (maximo <= 0) return 100
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  const normalizado = maximo / magnitud
  const paso =
    normalizado <= 1 ? 1
    : normalizado <= 1.5 ? 1.5
    : normalizado <= 2 ? 2
    : normalizado <= 2.5 ? 2.5
    : normalizado <= 3 ? 3
    : normalizado <= 4 ? 4
    : normalizado <= 5 ? 5
    : normalizado <= 7.5 ? 7.5
    : 10
  return paso * magnitud
}

/* ================================================================ */
/* Ventas vs gastos por mes, con linea de ganancia neta             */
/* ================================================================ */

export function GraficaMensual({ datos, alto = 240 }: { datos: PuntoMes[]; alto?: number }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activo, setActivo] = useState<number | null>(null)

  if (!datos.length) return null

  const margen = { arriba: 12, derecha: 12, abajo: 26, izquierda: 54 }
  const w = Math.max(ancho, 280)
  const anchoUtil = w - margen.izquierda - margen.derecha
  const altoUtil = alto - margen.arriba - margen.abajo

  const maximoBruto = Math.max(
    1,
    ...datos.map((d) => Math.max(d.ventas, d.gastos, d.gananciaNeta)),
  )
  const minimoBruto = Math.min(0, ...datos.map((d) => d.gananciaNeta))
  const techo = escalaBonita(maximoBruto)
  const piso = minimoBruto < 0 ? -escalaBonita(Math.abs(minimoBruto)) : 0
  const span = techo - piso || 1

  const y = (valor: number) => margen.arriba + altoUtil - ((valor - piso) / span) * altoUtil
  const anchoBanda = anchoUtil / datos.length
  const anchoBarra = Math.min(18, Math.max(5, anchoBanda * 0.28))
  const xBanda = (i: number) => margen.izquierda + anchoBanda * i + anchoBanda / 2

  // Con 12 meses en una pantalla de celular las etiquetas se enciman:
  // se dibuja una de cada N segun el espacio real disponible.
  const pasoEtiquetas = Math.max(1, Math.ceil(datos.length / Math.max(1, Math.floor(anchoUtil / 38))))

  const marcas = [techo, techo / 2, 0, piso].filter(
    (v, i, arr) => arr.indexOf(v) === i && v >= piso && v <= techo,
  )

  const puntosLinea = datos
    .map((d, i) => `${xBanda(i)},${y(d.gananciaNeta)}`)
    .join(' ')

  const punto = activo !== null ? datos[activo] : null

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={w} height={alto} role="img" aria-label="Ventas, gastos y ganancia por mes">
        {marcas.map((valor) => (
          <g key={valor}>
            <line
              x1={margen.izquierda}
              x2={w - margen.derecha}
              y1={y(valor)}
              y2={y(valor)}
              stroke="var(--borde)"
              strokeDasharray={valor === 0 ? undefined : '3 4'}
            />
            <text
              x={margen.izquierda - 8}
              y={y(valor) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--texto-3)"
            >
              {dineroCorto(valor)}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const cx = xBanda(i)
          const yCero = y(0)
          return (
            <g
              key={d.mes}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
            >
              <rect
                x={cx - anchoBanda / 2}
                y={margen.arriba}
                width={anchoBanda}
                height={altoUtil}
                fill={activo === i ? 'var(--superficie-3)' : 'transparent'}
                opacity={0.6}
              />
              <rect
                x={cx - anchoBarra - 2}
                y={y(d.ventas)}
                width={anchoBarra}
                height={Math.max(0, yCero - y(d.ventas))}
                rx={3}
                fill="var(--verde)"
                opacity={0.9}
              />
              <rect
                x={cx + 2}
                y={y(d.gastos)}
                width={anchoBarra}
                height={Math.max(0, yCero - y(d.gastos))}
                rx={3}
                fill="var(--rojo)"
                opacity={0.75}
              />
              {(i % pasoEtiquetas === 0 || activo === i) && (
                <text
                  x={cx}
                  y={alto - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={activo === i ? 'var(--texto)' : 'var(--texto-3)'}
                >
                  {nombreMes(d.mes, true)}
                </text>
              )}
            </g>
          )
        })}

        <polyline
          points={puntosLinea}
          fill="none"
          stroke="var(--acento)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
        {datos.map((d, i) => (
          <circle
            key={d.mes}
            cx={xBanda(i)}
            cy={y(d.gananciaNeta)}
            r={activo === i ? 4.5 : 3}
            fill="var(--superficie)"
            stroke="var(--acento)"
            strokeWidth={2}
            pointerEvents="none"
          />
        ))}
      </svg>

      {punto && (
        <div
          className="tooltip-gr"
          style={{
            left: Math.min(Math.max(xBanda(activo ?? 0) - 70, 0), Math.max(w - 150, 0)),
            top: 4,
          }}
        >
          <b>{nombreMes(punto.mes)}</b>
          <div>
            <span className="tenue">Ventas</span>
            <span className="num pos">{dinero(punto.ventas, 0)}</span>
          </div>
          <div>
            <span className="tenue">Salidas</span>
            <span className="num neg">{dinero(punto.gastos, 0)}</span>
          </div>
          <div>
            <span className="tenue">Ganancia</span>
            <span className={`num ${punto.gananciaNeta >= 0 ? 'pos' : 'neg'}`}>
              {dinero(punto.gananciaNeta, 0)}
            </span>
          </div>
        </div>
      )}

      <div className="gr-leyenda" style={{ marginTop: 6 }}>
        <span>
          <i className="gr-muestra" style={{ background: 'var(--verde)' }} /> Ventas
        </span>
        <span>
          <i className="gr-muestra" style={{ background: 'var(--rojo)' }} /> Salidas (gastos +
          mercancia)
        </span>
        <span>
          <i
            className="gr-muestra"
            style={{ background: 'var(--acento)', borderRadius: 999, height: 3, width: 14 }}
          />{' '}
          Ganancia neta
        </span>
      </div>
    </div>
  )
}

/* ================================================================ */
/* Desglose por categoria                                            */
/* ================================================================ */

export function ListaCategorias({
  rebanadas,
  vacio = 'Sin movimientos en este periodo.',
}: {
  rebanadas: RebanadaCategoria[]
  vacio?: string
}) {
  if (!rebanadas.length) return <p className="mini tenue">{vacio}</p>
  const mayor = rebanadas[0].monto || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rebanadas.map((r) => (
        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{r.nombre}</span>
            {r.inventario && <span className="pill azul mini">mercancia</span>}
            <span className="mini tenue-2" style={{ marginLeft: 'auto' }}>
              {porcentaje(r.porcentaje, 0)}
            </span>
            <span className="num" style={{ fontWeight: 650, fontSize: '0.86rem' }}>
              {dinero(r.monto, 0)}
            </span>
          </div>
          <div className="barra-progreso">
            <span
              style={{
                width: `${(r.monto / mayor) * 100}%`,
                background: r.inventario ? 'var(--azul)' : 'var(--rojo)',
                opacity: r.inventario ? 0.85 : 0.7,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================================================================ */
/* Sparkline para tarjetas de origen                                 */
/* ================================================================ */

export function MiniSpark({
  valores,
  color = 'var(--acento)',
  alto = 34,
}: {
  valores: number[]
  color?: string
  alto?: number
}) {
  if (valores.length < 2) return <div style={{ height: alto }} />
  const max = Math.max(...valores, 0)
  const min = Math.min(...valores, 0)
  const span = max - min || 1
  const paso = 100 / (valores.length - 1)
  const y = (v: number) => 100 - ((v - min) / span) * 100
  const linea = valores.map((v, i) => `${i * paso},${y(v)}`).join(' ')
  const area = `${linea} 100,${y(min)} 0,${y(min)}`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      height={alto}
      width="100%"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polygon points={area} fill={color} opacity={0.12} />
      {min < 0 && max > 0 && (
        <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="var(--borde-fuerte)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      <polyline
        points={linea}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
