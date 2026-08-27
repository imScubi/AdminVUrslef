import { useMemo } from 'react'
import { useTienda } from '../estado/tienda'
import {
  consolidado,
  fichasDeOrigenes,
  resumenPedidos,
  filtrarRango,
  gastosPorCategoria,
  generarAlertas,
  movimientosDe,
  serieMensual,
  type Rango,
} from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { GraficaMensual, ListaCategorias } from '../componentes/graficas'
import { ListaMovimientos } from '../componentes/ListaMovimientos'
import { TarjetaOrigen } from '../componentes/TarjetaOrigen'
import { Metrica, Vacio } from '../componentes/ui'

export function Panel({
  rango,
  onAbrirOrigen,
  onNuevoOrigen,
  onNuevoMovimiento,
  onVerMovimientos,
  onVerPedidos,
}: {
  rango: Rango
  onAbrirOrigen: (id: string) => void
  onNuevoOrigen: () => void
  onNuevoMovimiento: () => void
  onVerMovimientos: () => void
  onVerPedidos: () => void
}) {
  const { db } = useTienda()

  const { total, periodo } = useMemo(() => consolidado(db, rango), [db, rango])
  const fichas = useMemo(() => fichasDeOrigenes(db, rango), [db, rango])
  const alertas = useMemo(() => generarAlertas(db), [db])
  const pedidos = useMemo(() => resumenPedidos(db), [db])
  const serieGlobal = useMemo(
    () => serieMensual(db.movimientos, db.categorias, 6),
    [db.movimientos, db.categorias],
  )
  const movsPeriodo = useMemo(
    () => filtrarRango(db.movimientos, rango),
    [db.movimientos, rango],
  )
  const gastos = useMemo(
    () => gastosPorCategoria(movsPeriodo, db.categorias, 'gasto'),
    [movsPeriodo, db.categorias],
  )
  const retiros = useMemo(
    () => gastosPorCategoria(movsPeriodo, db.categorias, 'retiro'),
    [movsPeriodo, db.categorias],
  )

  const visibles = fichas.filter((f) => !f.origen.archivado)

  if (!db.origenes.length) {
    return (
      <Vacio
        icono="🚀"
        titulo="Empieza creando tu primer origen"
        texto="Un origen es cada negocio o fuente de dinero que manejas: la reventa, los servicios que das, un socio, lo que sea. Cada uno lleva su propia caja y sus propios numeros."
        accion={
          <button className="btn primario" onClick={onNuevoOrigen}>
            + Crear origen
          </button>
        }
      />
    )
  }

  return (
    <>
      <div className="rejilla c4">
        <Metrica
          destacada
          etiqueta="Dinero disponible"
          valor={dinero(total.caja)}
          tono={total.caja < 0 ? 'neg' : null}
          pie={`En ${visibles.length} origen${visibles.length === 1 ? '' : 'es'}`}
          ayuda="Suma de la caja de todos tus origenes: lo que realmente puedes gastar hoy."
        />
        <Metrica
          etiqueta="Valor total"
          valor={dinero(total.patrimonio)}
          pie={
            total.gananciaEsperadaPendiente !== null && total.gananciaEsperadaPendiente > 0.5
              ? `Incluye ${dineroCorto(total.inventario)} en mercancia, con ${dineroCorto(
                  total.gananciaEsperadaPendiente,
                )} de ganancia esperada`
              : total.inventario > 0.5
                ? `Incluye ${dineroCorto(total.inventario)} en mercancia`
                : 'Caja + mercancia sin vender'
          }
          ayuda="Caja + el costo de la mercancia que aun no vendes. Es lo que valen tus negocios ahora."
        />
        <Metrica
          etiqueta={`Ganancia ${rango.etiqueta.toLowerCase()}`}
          valor={dinero(periodo.gananciaNeta)}
          tono={periodo.gananciaNeta >= 0 ? 'pos' : 'neg'}
          pie={`${dineroCorto(periodo.ventas)} vendido · margen ${porcentaje(periodo.margen, 0)}`}
          ayuda="Ventas menos el costo de lo vendido menos los gastos de operar. La ganancia real."
        />
        <Metrica
          etiqueta={`Sacaste ${rango.etiqueta.toLowerCase()}`}
          valor={dinero(periodo.retiros)}
          pie={
            periodo.gananciaNeta > 0
              ? `${porcentaje((periodo.retiros / periodo.gananciaNeta) * 100, 0)} de lo que ganaste`
              : 'Retiros para uso personal'
          }
          ayuda="Dinero que sacaste de los negocios para ti. Si esto supera la ganancia, te estas comiendo el capital."
        />
      </div>

      {pedidos.abiertos > 0 && (
        <button
          className="tarjeta banda-pedidos"
          onClick={onVerPedidos}
          aria-label="Ver pedidos abiertos"
        >
          <span className="banda-pedidos-icono">🧾</span>
          <div>
            <div style={{ fontWeight: 680 }}>
              Te deben {dinero(pedidos.porCobrar)} en {pedidos.abiertos} pedido
              {pedidos.abiertos === 1 ? '' : 's'}
            </div>
            <div className="mini tenue">
              {pedidos.sinAbonar > 0
                ? `${pedidos.sinAbonar} sin un solo abono todavia`
                : `Llevan ${dineroCorto(pedidos.abonado)} abonados`}
            </div>
          </div>
          <span className="banda-pedidos-flecha">›</span>
        </button>
      )}

      {alertas.length > 0 && (
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Que revisar</h2>
            <span className="pill">{alertas.length}</span>
          </div>
          <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {alertas.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className={`alerta ${a.nivel}`}
                onClick={() => a.origenId && onAbrirOrigen(a.origenId)}
                style={{ cursor: a.origenId ? 'pointer' : 'default' }}
              >
                <span className="alerta-icono">{a.nivel === 'peligro' ? '⛔' : '⚠️'}</span>
                <div>
                  <div className="alerta-titulo">{a.titulo}</div>
                  <div className="alerta-detalle">{a.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Como va el conjunto</h2>
          <span className="mini tenue">Ultimos 6 meses</span>
        </div>
        <div className="tarjeta-cuerpo">
          <GraficaMensual datos={serieGlobal} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h2>Tus origenes</h2>
          <span className="mini tenue">{rango.etiqueta}</span>
          <button className="btn chico" style={{ marginLeft: 'auto' }} onClick={onNuevoOrigen}>
            + Origen
          </button>
        </div>
        <div className="rejilla auto">
          {visibles.map((f) => (
            <TarjetaOrigen
              key={f.origen.id}
              ficha={f}
              etiquetaPeriodo={rango.etiqueta}
              serie={serieMensual(
                movimientosDe(db.movimientos, f.origen.id),
                db.categorias,
                6,
                f.origen.id,
              ).map((p) => p.gananciaNeta)}
              onAbrir={() => onAbrirOrigen(f.origen.id)}
            />
          ))}
        </div>
      </div>

      <div className="rejilla anchas">
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>En que se fue el dinero</h2>
            <span className="mini tenue">{rango.etiqueta}</span>
          </div>
          <div className="tarjeta-cuerpo">
            <ListaCategorias rebanadas={gastos} vacio="No registraste gastos en este periodo." />
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>En que te lo gastaste tu</h2>
            <span className="mini tenue">Retiros · {rango.etiqueta}</span>
          </div>
          <div className="tarjeta-cuerpo">
            <ListaCategorias
              rebanadas={retiros}
              vacio="No sacaste dinero de los negocios en este periodo."
            />
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Ultimos movimientos</h2>
          <div className="barra-acciones">
            <button className="btn chico fantasma" onClick={onVerMovimientos}>
              Ver todos
            </button>
            <button className="btn chico primario" onClick={onNuevoMovimiento}>
              + Registrar
            </button>
          </div>
        </div>
        <ListaMovimientos movimientos={db.movimientos} limite={8} />
      </div>
    </>
  )
}
