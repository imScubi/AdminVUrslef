import { useMemo, useState } from 'react'
import { useTienda } from '../estado/tienda'
import {
  fichaDeOrigen,
  filtrarRango,
  gastosPorCategoria,
  inventarioDe,
  movimientosDe,
  serieMensual,
  type Rango,
} from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { ETIQUETA_TIPO_ORIGEN, type TipoMovimiento } from '../tipos'
import { GraficaMensual, ListaCategorias } from '../componentes/graficas'
import { ListaMovimientos } from '../componentes/ListaMovimientos'
import { Confirmar, Metrica, Vacio } from '../componentes/ui'
import { AvatarOrigen } from '../componentes/AvatarOrigen'
import { FormOrigen } from '../componentes/FormOrigen'

const FILTROS: Array<{ id: TipoMovimiento | 'todos'; etiqueta: string }> = [
  { id: 'todos', etiqueta: 'Todo' },
  { id: 'venta', etiqueta: 'Ventas' },
  { id: 'gasto', etiqueta: 'Gastos' },
  { id: 'retiro', etiqueta: 'Retiros' },
  { id: 'aporte', etiqueta: 'Aportes' },
  { id: 'traspaso', etiqueta: 'Traspasos' },
]

export function DetalleOrigen({
  origenId,
  rango,
  onNuevoMovimiento,
  onSalir,
}: {
  origenId: string
  rango: Rango
  onNuevoMovimiento: (origenId: string) => void
  onSalir: () => void
}) {
  const { db, editarOrigen, borrarOrigen } = useTienda()
  const [editando, setEditando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [filtro, setFiltro] = useState<TipoMovimiento | 'todos'>('todos')

  const origen = db.origenes.find((o) => o.id === origenId)

  const propios = useMemo(
    () => (origen ? movimientosDe(db.movimientos, origen.id) : []),
    [db.movimientos, origen],
  )
  const ficha = useMemo(
    () => (origen ? fichaDeOrigen(db, origen, rango) : null),
    [db, origen, rango],
  )
  const serie = useMemo(
    () => (origen ? serieMensual(propios, db.categorias, 12, origen.id) : []),
    [propios, db.categorias, origen],
  )
  const existencias = useMemo(
    () => (origen ? inventarioDe(db, origen.id).filter((e) => e.disponibles > 0) : []),
    [db, origen],
  )
  const gastosCat = useMemo(
    () => gastosPorCategoria(filtrarRango(propios, rango), db.categorias, 'gasto'),
    [propios, rango, db.categorias],
  )

  if (!origen || !ficha) {
    return (
      <Vacio
        icono="🔍"
        titulo="Ese origen ya no existe"
        accion={
          <button className="btn" onClick={onSalir}>
            Volver al panel
          </button>
        }
      />
    )
  }

  const { total, periodo } = ficha
  const historial =
    filtro === 'todos' ? propios : propios.filter((m) => m.tipo === filtro)

  const mesesActivo = Math.max(
    1,
    serie.filter((p) => p.ventas > 0 || p.gastos > 0).length,
  )
  const gananciaPromedioMes = total.gananciaNeta / mesesActivo

  return (
    <>
      <div className="cabecera-origen" style={{ ['--color-origen' as string]: origen.color }}>
        <AvatarOrigen origen={origen} tamano={52} redondeo={15} />
        <div style={{ minWidth: 0 }}>
          <h1>{origen.nombre}</h1>
          <div className="mini tenue" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill">{ETIQUETA_TIPO_ORIGEN[origen.tipo]}</span>
            <span>{total.numVentas} ventas registradas</span>
            {total.ultimaVenta && <span>· ultima venta hace {total.diasSinVender} dias</span>}
            {origen.archivado && <span className="pill ambar">archivado</span>}
          </div>
        </div>
        <div className="barra-acciones">
          <button className="btn chico" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button
            className="btn chico"
            onClick={() => editarOrigen(origen.id, { archivado: !origen.archivado })}
          >
            {origen.archivado ? 'Reactivar' : 'Archivar'}
          </button>
          <button className="btn chico peligro" onClick={() => setBorrando(true)}>
            Borrar
          </button>
          <button className="btn chico primario" onClick={() => onNuevoMovimiento(origen.id)}>
            + Registrar
          </button>
        </div>
      </div>

      {/* --- Situacion actual (historico completo) --- */}
      <div>
        <h2 style={{ marginBottom: 10 }}>Situacion actual</h2>
        <div className="rejilla c4">
          <Metrica
            destacada
            etiqueta="Caja"
            valor={dinero(total.caja)}
            tono={total.caja < 0 ? 'neg' : null}
            pie="Dinero disponible de este origen"
            ayuda="Todo lo que entro menos todo lo que salio de este origen desde el dia uno."
          />
          <Metrica
            etiqueta="Mercancia sin vender"
            valor={dinero(Math.max(total.inventario, 0))}
            pie={
              total.valorEsperadoInventario !== null
                ? `Esperas ~${dineroCorto(total.valorEsperadoInventario)} al venderla · ${dineroCorto(
                    total.gananciaEsperadaPendiente ?? 0,
                  )} de ganancia`
                : total.inventario > 0.5
                  ? 'Dinero tuyo parado en inventario'
                  : 'Sin mercancia pendiente registrada'
            }
            ayuda="Lo que compraste como mercancia menos el costo de lo que ya vendiste. Si al comprar anotas en cuanto esperas venderla, aqui se proyecta cuanto deberia regresarte."
          />
          <Metrica
            etiqueta="Valor del origen"
            valor={dinero(total.patrimonio)}
            pie="Caja + mercancia"
            ayuda="Lo que vale este negocio ahora mismo si vendieras todo a costo."
          />
          <Metrica
            etiqueta="Ganancia acumulada"
            valor={dinero(total.gananciaNeta)}
            tono={total.gananciaNeta >= 0 ? 'pos' : 'neg'}
            pie={`~${dineroCorto(gananciaPromedioMes)} por mes activo`}
            ayuda="Toda la ganancia neta desde que arranco este origen."
          />
        </div>
      </div>

      {/* --- ¿Dio fruto? --- */}
      {(total.aportes > 0 || total.retiros > 0) && (
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>¿Este origen dio fruto?</h2>
          </div>
          <div className="tarjeta-cuerpo">
            <div className="rejilla c4">
              <Metrica
                mediana
                etiqueta="Capital que metiste"
                valor={dinero(total.aportes)}
                pie="Aportes registrados"
              />
              <Metrica
                mediana
                etiqueta="Ya te regresaste"
                valor={dinero(total.retiros)}
                pie={
                  total.recuperado !== null
                    ? `${porcentaje(total.recuperado, 0)} de lo que metiste`
                    : 'Retiros a tu bolsillo'
                }
                tono={total.recuperado !== null && total.recuperado >= 100 ? 'pos' : null}
              />
              <Metrica
                mediana
                etiqueta="ROI"
                valor={porcentaje(total.roi, 0)}
                tono={total.roi !== null && total.roi >= 0 ? 'pos' : 'neg'}
                pie="Ganancia sobre el capital aportado"
                ayuda="Por cada peso de capital que metiste, cuanto has ganado."
              />
              <Metrica
                mediana
                etiqueta="Rinde por peso"
                valor={
                  total.rendimientoPorPeso !== null
                    ? `${total.rendimientoPorPeso >= 0 ? '+' : ''}${dinero(total.rendimientoPorPeso)}`
                    : '—'
                }
                tono={
                  total.rendimientoPorPeso !== null && total.rendimientoPorPeso >= 0 ? 'pos' : 'neg'
                }
                pie="Ganancia por cada $1 gastado"
                ayuda="Ganancia neta dividida entre todo lo que costo operar (costo de lo vendido + gastos)."
              />
            </div>
            <p className="mini tenue" style={{ marginTop: 14 }}>
              {resumenEnPalabras(total.aportes, total.retiros, total.gananciaNeta, total.caja)}
            </p>
          </div>
        </div>
      )}

      {/* --- Desempeño del periodo --- */}
      <div>
        <h2 style={{ marginBottom: 10 }}>
          Desempeño · <span className="tenue" style={{ fontWeight: 500 }}>{rango.etiqueta}</span>
        </h2>
        <div className="rejilla c4">
          <Metrica mediana etiqueta="Vendido" valor={dinero(periodo.ventas)} pie={`${periodo.numVentas} ventas`} />
          <Metrica
            mediana
            etiqueta="Ganancia bruta"
            valor={dinero(periodo.gananciaBruta)}
            pie={`Margen ${porcentaje(periodo.margen, 0)}`}
            tono={periodo.gananciaBruta >= 0 ? 'pos' : 'neg'}
            ayuda="Ventas menos el costo de la mercancia vendida, antes de gastos."
          />
          <Metrica
            mediana
            etiqueta="Gastos de operar"
            valor={dinero(periodo.gastosOperativos)}
            pie={
              periodo.comprasInventario > 0
                ? `+ ${dineroCorto(periodo.comprasInventario)} en mercancia`
                : 'Sin contar compra de mercancia'
            }
          />
          <Metrica
            mediana
            etiqueta="Ganancia neta"
            valor={dinero(periodo.gananciaNeta)}
            tono={periodo.gananciaNeta >= 0 ? 'pos' : 'neg'}
            pie={
              origen.metaMensual > 0
                ? `Meta ${dineroCorto(origen.metaMensual)} · ${porcentaje(
                    (periodo.gananciaNeta / origen.metaMensual) * 100,
                    0,
                  )}`
                : `Margen neto ${porcentaje(periodo.margenNeto, 0)}`
            }
          />
          {total.margenEsperado !== null ? (
            <Metrica
              mediana
              etiqueta="Margen: real vs esperado"
              valor={`${porcentaje(periodo.margen, 0)} / ${porcentaje(total.margenEsperado, 0)}`}
              tono={
                periodo.margen !== null && periodo.margen >= total.margenEsperado ? 'pos' : 'neg'
              }
              pie={
                periodo.margen !== null && periodo.margen >= total.margenEsperado
                  ? 'Vas por encima de lo que planeaste'
                  : 'Estas vendiendo mas barato de lo planeado'
              }
              ayuda="El primero es el margen que llevas de verdad; el segundo, el que esperabas cuando compraste la mercancia."
            />
          ) : (
            <Metrica mediana etiqueta="Ticket promedio" valor={dinero(periodo.ticketPromedio ?? 0)} />
          )}
          <Metrica mediana etiqueta="Retiros" valor={dinero(periodo.retiros)} />
          <Metrica mediana etiqueta="Aportes" valor={dinero(periodo.aportes)} />
          <Metrica
            mediana
            etiqueta="Traspasos"
            valor={dinero(periodo.entradas - periodo.salidas)}
            pie={`Entro ${dineroCorto(periodo.entradas)} · salio ${dineroCorto(periodo.salidas)}`}
          />
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Historia mes a mes</h2>
          <span className="mini tenue">Ultimos 12 meses</span>
        </div>
        <div className="tarjeta-cuerpo">
          <GraficaMensual datos={serie} alto={250} />
        </div>
      </div>

      {existencias.length > 0 && (
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Que tienes en existencia</h2>
            <span className="mini tenue">
              {dinero(
                existencias.reduce((s, e) => s + e.valorDisponible, 0),
                0,
              )}{' '}
              a costo
            </span>
          </div>
          <div>
            {existencias.map((e) => (
              <div className="movimiento" key={e.articulo.id}>
                <div
                  className="mov-icono"
                  style={{ background: 'var(--azul-suave)', color: 'var(--azul)' }}
                >
                  📦
                </div>
                <div className="mov-cuerpo">
                  <div className="mov-concepto">{e.articulo.nombre}</div>
                  <div className="mov-meta">
                    <span>
                      quedan {e.disponibles} de {e.comprados}
                    </span>
                    <span>costo {dinero(e.articulo.costoUnitario, 0)} c/u</span>
                    {e.articulo.precio ? <span className="pos">vende {dinero(e.articulo.precio, 0)}</span> : null}
                  </div>
                </div>
                <div className="mov-monto">
                  <div>{dinero(e.valorDisponible, 0)}</div>
                  {e.valorEsperado !== null && (
                    <div className="mini tenue-2">valen {dinero(e.valorEsperado, 0)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rejilla anchas">
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Gastos por categoria</h2>
            <span className="mini tenue">{rango.etiqueta}</span>
          </div>
          <div className="tarjeta-cuerpo">
            <ListaCategorias rebanadas={gastosCat} vacio="Sin gastos registrados en el periodo." />
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Notas</h2>
          </div>
          <div className="tarjeta-cuerpo">
            {origen.notas ? (
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{origen.notas}</p>
            ) : (
              <p className="mini tenue">
                Sin notas. Sirven para guardar proveedores, precios de referencia o reglas que te
                pones para este negocio.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Historial completo</h2>
          <div className="barra-acciones">
            <div className="segmentado">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  className={filtro === f.id ? 'activo' : ''}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ListaMovimientos
          movimientos={historial}
          origenId={origen.id}
          mostrarOrigen={false}
          vacioTexto="Registra tu primer movimiento en este origen."
        />
      </div>

      {editando && <FormOrigen origen={origen} onCerrar={() => setEditando(false)} />}
      {borrando && (
        <Confirmar
          titulo={`Borrar ${origen.nombre}`}
          mensaje="Se borran tambien todos sus movimientos y su historial. Si solo quieres dejar de usarlo, mejor archivalo."
          textoConfirmar="Borrar todo"
          onCancelar={() => setBorrando(false)}
          onConfirmar={() => {
            borrarOrigen(origen.id)
            setBorrando(false)
            onSalir()
          }}
        />
      )}
    </>
  )
}

function resumenEnPalabras(
  aportes: number,
  retiros: number,
  ganancia: number,
  caja: number,
): string {
  if (aportes <= 0) {
    return `Aun no registras capital aportado a este origen. Si le metiste dinero de tu bolsa, registralo como aporte para poder medir el ROI. Por ahora ha generado ${dinero(ganancia)} de ganancia y tiene ${dinero(caja)} en caja.`
  }
  const falta = aportes - retiros
  if (falta > 0) {
    return `Metiste ${dinero(aportes)} y ya sacaste ${dinero(retiros)}. Te faltan ${dinero(falta)} para recuperar tu inversion, aunque el negocio lleva ${dinero(ganancia)} de ganancia acumulada y ${dinero(caja)} disponibles en caja.`
  }
  return `Ya recuperaste todo lo que metiste (${dinero(aportes)}) y llevas ${dinero(retiros - aportes)} de mas en el bolsillo. Ademas quedan ${dinero(caja)} en la caja del origen.`
}
