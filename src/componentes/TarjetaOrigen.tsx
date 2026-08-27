import type { FichaOrigen } from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { ETIQUETA_TIPO_ORIGEN } from '../tipos'
import { MiniSpark } from './graficas'
import { BarraProgreso } from './ui'

export function TarjetaOrigen({
  ficha,
  serie,
  etiquetaPeriodo,
  onAbrir,
}: {
  ficha: FichaOrigen
  serie: number[]
  etiquetaPeriodo: string
  onAbrir: () => void
}) {
  const { origen, total, periodo } = ficha
  const avanceMeta =
    origen.metaMensual > 0 ? (periodo.gananciaNeta / origen.metaMensual) * 100 : null

  return (
    <button className="tarjeta-origen" onClick={onAbrir}>
      <div className="tarjeta-origen-cinta" style={{ background: origen.color }} />
      <div className="tarjeta-origen-cuerpo">
        <div className="tarjeta-origen-cab">
          <span style={{ fontSize: '1.25rem' }}>{origen.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div className="tarjeta-origen-nombre">{origen.nombre}</div>
            <div className="mini tenue-2">{ETIQUETA_TIPO_ORIGEN[origen.tipo]}</div>
          </div>
          {total.diasSinVender !== null && total.diasSinVender > 30 && (
            <span className="pill ambar" style={{ marginLeft: 'auto' }}>
              {total.diasSinVender}d sin vender
            </span>
          )}
        </div>

        <div>
          <div className="mini tenue-2" style={{ fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Disponible en caja
          </div>
          <div
            className={`num ${total.caja < 0 ? 'neg' : ''}`}
            style={{ fontSize: '1.35rem', fontWeight: 680, letterSpacing: '-0.02em' }}
          >
            {dinero(total.caja)}
          </div>
          {total.inventario > 0.5 && (
            <div className="mini tenue">+ {dineroCorto(total.inventario)} en mercancia</div>
          )}
        </div>

        <MiniSpark valores={serie} color={origen.color} />

        <div className="mini-metricas">
          <div className="mini-metrica">
            <span>Ganancia</span>
            <span className={periodo.gananciaNeta >= 0 ? 'pos' : 'neg'}>
              {dineroCorto(periodo.gananciaNeta)}
            </span>
          </div>
          <div className="mini-metrica">
            <span>Margen</span>
            <span>{porcentaje(periodo.margen, 0)}</span>
          </div>
          <div className="mini-metrica">
            <span>Ventas</span>
            <span>{periodo.numVentas}</span>
          </div>
        </div>

        {avanceMeta !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="mini tenue" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Meta {etiquetaPeriodo.toLowerCase()}</span>
              <span className="num">{porcentaje(Math.max(avanceMeta, 0), 0)}</span>
            </div>
            <BarraProgreso
              valor={avanceMeta}
              color={avanceMeta >= 100 ? 'var(--verde)' : origen.color}
            />
          </div>
        )}
      </div>
    </button>
  )
}
