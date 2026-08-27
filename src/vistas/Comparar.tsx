import { useMemo } from 'react'
import { useTienda } from '../estado/tienda'
import { compararOrigenes, type Rango } from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { BarraProgreso, Vacio } from '../componentes/ui'

export function Comparar({
  rango,
  onAbrirOrigen,
}: {
  rango: Rango
  onAbrirOrigen: (id: string) => void
}) {
  const { db } = useTienda()
  const filas = useMemo(() => compararOrigenes(db, rango), [db, rango])

  if (filas.length < 1) {
    return (
      <Vacio
        icono="⚖️"
        titulo="Nada que comparar todavia"
        texto="Cuando tengas al menos dos origenes con movimientos, aqui vas a ver cual te conviene mas."
      />
    )
  }

  const patrimonioTotal = filas.reduce((s, f) => s + Math.max(f.ficha.total.patrimonio, 0), 0)
  const mejorMargen = [...filas].sort(
    (a, b) => (b.ficha.periodo.margen ?? -999) - (a.ficha.periodo.margen ?? -999),
  )[0]
  const mejorRendimiento = [...filas].sort(
    (a, b) => (b.ficha.periodo.rendimientoPorPeso ?? -999) - (a.ficha.periodo.rendimientoPorPeso ?? -999),
  )[0]
  const mejorGanancia = [...filas].sort((a, b) => b.gananciaMensual - a.gananciaMensual)[0]
  const lider = filas[0]

  return (
    <>
      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>A donde conviene meterle</h2>
          <span className="mini tenue">{rango.etiqueta}</span>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="alerta bien">
            <span className="alerta-icono">🎯</span>
            <div>
              <div className="alerta-titulo">
                {lider.ficha.origen.emoji} {lider.ficha.origen.nombre} es el que mejor pinta ahora
              </div>
              <div className="alerta-detalle">
                Deja {dinero(lider.gananciaMensual, 0)} al mes con {porcentaje(lider.ficha.periodo.margen, 0)}{' '}
                de margen
                {lider.tendencia !== null &&
                  `, y viene ${lider.tendencia >= 0 ? 'a la alza' : 'a la baja'} (${
                    lider.tendencia >= 0 ? '+' : ''
                  }${lider.tendencia.toFixed(0)}% contra la primera mitad del periodo)`}
                . El puntaje mezcla cuanto deja, que tan rentable es cada venta, cuanto rinde cada
                peso que le metes y para donde va la tendencia.
              </div>
            </div>
          </div>

          <div className="rejilla c3">
            <MiniDato
              titulo="Mas rentable por venta"
              origen={`${mejorMargen.ficha.origen.emoji} ${mejorMargen.ficha.origen.nombre}`}
              valor={porcentaje(mejorMargen.ficha.periodo.margen, 0)}
              pie="de margen bruto"
            />
            <MiniDato
              titulo="Rinde mas por peso metido"
              origen={`${mejorRendimiento.ficha.origen.emoji} ${mejorRendimiento.ficha.origen.nombre}`}
              valor={
                mejorRendimiento.ficha.periodo.rendimientoPorPeso !== null
                  ? dinero(mejorRendimiento.ficha.periodo.rendimientoPorPeso)
                  : '—'
              }
              pie="de ganancia por cada $1"
            />
            <MiniDato
              titulo="Mas dinero al mes"
              origen={`${mejorGanancia.ficha.origen.emoji} ${mejorGanancia.ficha.origen.nombre}`}
              valor={dineroCorto(mejorGanancia.gananciaMensual)}
              pie="de ganancia mensual"
            />
          </div>

          <p className="mini tenue">
            Ojo: el puntaje es una guia, no un oraculo. Un origen con poco tiempo o pocas ventas
            puede salir muy arriba por pura suerte. Contrastalo con lo que sabes del negocio.
          </p>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Tabla comparativa</h2>
        </div>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Origen</th>
                <th className="num">Puntaje</th>
                <th className="num">Ganancia / mes</th>
                <th className="num">Margen</th>
                <th className="num">Rinde por $1</th>
                <th className="num">ROI</th>
                <th className="num">Tendencia</th>
                <th className="num">Caja</th>
                <th className="num">Mercancia parada</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr
                  key={f.ficha.origen.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAbrirOrigen(f.ficha.origen.id)}
                >
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <i className="punto" style={{ background: f.ficha.origen.color }} />
                      {f.ficha.origen.emoji} {f.ficha.origen.nombre}
                    </span>
                  </td>
                  <td className="num" style={{ minWidth: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 26 }}>{f.puntaje}</span>
                      <div style={{ flex: 1 }}>
                        <BarraProgreso valor={f.puntaje} color={f.ficha.origen.color} />
                      </div>
                    </div>
                  </td>
                  <td className={`num ${f.gananciaMensual >= 0 ? 'pos' : 'neg'}`}>
                    {dinero(f.gananciaMensual, 0)}
                  </td>
                  <td className="num">{porcentaje(f.ficha.periodo.margen, 0)}</td>
                  <td className="num">
                    {f.ficha.periodo.rendimientoPorPeso !== null
                      ? dinero(f.ficha.periodo.rendimientoPorPeso)
                      : '—'}
                  </td>
                  <td className="num">{porcentaje(f.ficha.total.roi, 0)}</td>
                  <td className={`num ${(f.tendencia ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                    {f.tendencia === null ? '—' : `${f.tendencia >= 0 ? '+' : ''}${f.tendencia.toFixed(0)}%`}
                  </td>
                  <td className="num">{dinero(f.ficha.total.caja, 0)}</td>
                  <td className="num">
                    {f.ficha.total.inventario > 0.5 ? dinero(f.ficha.total.inventario, 0) : '—'}
                    {f.diasInventario !== null && (
                      <div className="mini tenue-2">~{Math.round(f.diasInventario)} dias</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Donde esta tu dinero</h2>
          <span className="mini tenue">Caja + mercancia por origen</span>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
            {filas.map((f) => {
              const parte = patrimonioTotal > 0 ? (Math.max(f.ficha.total.patrimonio, 0) / patrimonioTotal) * 100 : 0
              return (
                <div
                  key={f.ficha.origen.id}
                  title={`${f.ficha.origen.nombre}: ${porcentaje(parte, 0)}`}
                  style={{ width: `${parte}%`, background: f.ficha.origen.color }}
                />
              )
            })}
          </div>
          <div className="gr-leyenda">
            {filas.map((f) => (
              <span key={f.ficha.origen.id}>
                <i className="gr-muestra" style={{ background: f.ficha.origen.color }} />
                {f.ficha.origen.nombre} · {dineroCorto(f.ficha.total.patrimonio)} (
                {porcentaje(
                  patrimonioTotal > 0
                    ? (Math.max(f.ficha.total.patrimonio, 0) / patrimonioTotal) * 100
                    : 0,
                  0,
                )}
                )
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function MiniDato({
  titulo,
  origen,
  valor,
  pie,
}: {
  titulo: string
  origen: string
  valor: string
  pie: string
}) {
  return (
    <div className="metrica">
      <div className="metrica-etiqueta">{titulo}</div>
      <div className="metrica-valor mediana">{valor}</div>
      <div className="metrica-pie">
        {origen} · {pie}
      </div>
    </div>
  )
}
