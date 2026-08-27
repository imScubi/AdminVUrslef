import { useMemo, useState } from 'react'
import { useTienda } from '../estado/tienda'
import { estadoDeCuenta, resumenPedidos } from '../lib/calculos'
import { dinero, dineroCorto, porcentaje } from '../lib/formato'
import { fechaRelativa } from '../lib/fechas'
import { ETIQUETA_ESTADO_PEDIDO, ETIQUETA_TIPO_PEDIDO, type EstadoPedido } from '../tipos'
import { BarraProgreso, Metrica, Vacio } from '../componentes/ui'

const FILTROS: Array<{ id: EstadoPedido | 'todos'; etiqueta: string }> = [
  { id: 'abierto', etiqueta: 'Abiertos' },
  { id: 'liquidado', etiqueta: 'Liquidados' },
  { id: 'cancelado', etiqueta: 'Cancelados' },
  { id: 'todos', etiqueta: 'Todos' },
]

const ICONO_TIPO = { venta: '💵', separacion: '🔖', pedido: '📦' } as const

export function Pedidos({
  onAbrirPedido,
  onNuevoPedido,
}: {
  onAbrirPedido: (id: string) => void
  onNuevoPedido: () => void
}) {
  const { db } = useTienda()
  const [filtro, setFiltro] = useState<EstadoPedido | 'todos'>('abierto')
  const [origenId, setOrigenId] = useState('')
  const [texto, setTexto] = useState('')

  const resumen = useMemo(() => resumenPedidos(db), [db])

  const lista = useMemo(() => {
    const busqueda = texto.trim().toLowerCase()
    return db.pedidos
      .filter((p) => {
        if (filtro !== 'todos' && p.estado !== filtro) return false
        if (origenId && p.origenId !== origenId) return false
        if (busqueda) {
          const heno = `${p.cliente} ${p.concepto} ${p.telefono} ${p.notas}`.toLowerCase()
          if (!heno.includes(busqueda)) return false
        }
        return true
      })
      .map((p) => estadoDeCuenta(p, db.movimientos))
      .sort((a, b) =>
        a.pedido.fecha === b.pedido.fecha
          ? b.pedido.creadoEn.localeCompare(a.pedido.creadoEn)
          : b.pedido.fecha.localeCompare(a.pedido.fecha),
      )
  }, [db, filtro, origenId, texto])

  if (!db.origenes.length) {
    return (
      <Vacio
        icono="🧾"
        titulo="Primero crea un negocio"
        texto="Los pedidos y recibos pertenecen a un origen de ingreso. Crea uno en el panel y vuelve aqui."
      />
    )
  }

  return (
    <>
      <div className="rejilla c3">
        <Metrica
          destacada
          etiqueta="Te deben"
          valor={dinero(resumen.porCobrar)}
          pie={`En ${resumen.abiertos} pedido${resumen.abiertos === 1 ? '' : 's'} abierto${
            resumen.abiertos === 1 ? '' : 's'
          }`}
          ayuda="Suma de los saldos pendientes de todos los pedidos que siguen abiertos."
        />
        <Metrica
          mediana
          etiqueta="Ya abonado"
          valor={dinero(resumen.abonado)}
          pie="De esos mismos pedidos"
          tono="pos"
        />
        <Metrica
          mediana
          etiqueta="Sin un solo abono"
          valor={String(resumen.sinAbonar)}
          pie={resumen.sinAbonar > 0 ? 'Vale la pena recordarles' : 'Todos han abonado algo'}
          tono={resumen.sinAbonar > 0 ? 'neg' : null}
        />
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Pedidos y separaciones</h2>
          <div className="barra-acciones">
            <button className="btn chico primario" onClick={onNuevoPedido}>
              + Nuevo
            </button>
          </div>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="segmentado" style={{ marginBottom: 12 }}>
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
          <div className="fila">
            <div className="campo" style={{ flex: '2 1 200px' }}>
              <label htmlFor="pd-buscar">Buscar</label>
              <input
                id="pd-buscar"
                type="search"
                placeholder="Cliente, telefono o lo que lleva…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="pd-filtro-origen">Negocio</label>
              <select
                id="pd-filtro-origen"
                value={origenId}
                onChange={(e) => setOrigenId(e.target.value)}
              >
                <option value="">Todos</option>
                {db.origenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.emoji} {o.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <Vacio
          icono="🧾"
          titulo="Nada por aqui"
          texto={
            filtro === 'abierto'
              ? 'No tienes pedidos abiertos. Cuando alguien te aparte algo o te encargue un pedido, registralo y podras darle su recibo de cada abono.'
              : 'Ningun pedido coincide con lo que buscas.'
          }
          accion={
            <button className="btn primario" onClick={onNuevoPedido}>
              + Nuevo pedido
            </button>
          }
        />
      ) : (
        <div className="lista-pedidos">
          {lista.map((c) => {
            const origen = db.origenes.find((o) => o.id === c.pedido.origenId)
            return (
              <button
                key={c.pedido.id}
                className="pedido-fila"
                onClick={() => onAbrirPedido(c.pedido.id)}
              >
                <div className="pedido-cab">
                  <span className="pedido-icono">{ICONO_TIPO[c.pedido.tipo]}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="pedido-cliente">{c.pedido.cliente || 'Sin nombre'}</div>
                    <div className="mini tenue-2 pedido-concepto">
                      {c.pedido.concepto || ETIQUETA_TIPO_PEDIDO[c.pedido.tipo]}
                    </div>
                  </div>
                  <div className="derecha">
                    <div className="num" style={{ fontWeight: 680 }}>
                      {dinero(c.pedido.total, 0)}
                    </div>
                    <div
                      className={`mini ${c.liquidado ? 'pos' : 'neg'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {c.liquidado ? 'liquidado' : `debe ${dineroCorto(c.saldo)}`}
                    </div>
                  </div>
                </div>

                <BarraProgreso
                  valor={c.avance}
                  color={c.liquidado ? 'var(--verde)' : (origen?.color ?? 'var(--acento)')}
                />

                <div className="pedido-pie mini tenue-2">
                  {origen && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <i className="punto" style={{ background: origen.color }} />
                      {origen.nombre}
                    </span>
                  )}
                  <span>{porcentaje(c.avance, 0)} pagado</span>
                  <span>{c.abonos.length} abono{c.abonos.length === 1 ? '' : 's'}</span>
                  <span style={{ marginLeft: 'auto' }}>{fechaRelativa(c.pedido.fecha)}</span>
                  {c.pedido.estado === 'cancelado' && (
                    <span className="pill rojo">{ETIQUETA_ESTADO_PEDIDO.cancelado}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
