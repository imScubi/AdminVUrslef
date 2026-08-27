import { useMemo, useState } from 'react'
import type { EstadoPedido, LineaPedido, MetodoPago, Pedido, TipoPedido } from '../tipos'
import { ETIQUETA_ESTADO_PEDIDO, ETIQUETA_METODO, ETIQUETA_TIPO_PEDIDO } from '../tipos'
import { useTienda } from '../estado/tienda'
import { inventarioDe } from '../lib/calculos'
import { aNumero, dinero } from '../lib/formato'
import { hoy } from '../lib/fechas'
import { Modal } from './ui'

const AYUDA_TIPO: Record<TipoPedido, string> = {
  venta: 'Se paga y se entrega en el momento.',
  separacion: 'El cliente aparta y va abonando hasta liquidar.',
  pedido: 'Se encarga, das anticipo y se paga al entregar.',
}

export function FormPedido({
  pedido,
  origenInicial,
  onCerrar,
}: {
  pedido?: Pedido
  origenInicial?: string
  onCerrar: (id?: string) => void
}) {
  const { db, agregarPedido, editarPedido, registrarAbono } = useTienda()
  const activos = db.origenes.filter((o) => !o.archivado || o.id === pedido?.origenId)

  const [origenId, setOrigenId] = useState(
    pedido?.origenId ?? origenInicial ?? activos[0]?.id ?? '',
  )
  const [tipo, setTipo] = useState<TipoPedido>(pedido?.tipo ?? 'separacion')
  const [cliente, setCliente] = useState(pedido?.cliente ?? '')
  const [telefono, setTelefono] = useState(pedido?.telefono ?? '')
  const [concepto, setConcepto] = useState(pedido?.concepto ?? '')
  const [total, setTotal] = useState(pedido ? String(pedido.total) : '')
  const [fecha, setFecha] = useState(pedido?.fecha ?? hoy())
  const [estado, setEstado] = useState<EstadoPedido>(pedido?.estado ?? 'abierto')
  const [notas, setNotas] = useState(pedido?.notas ?? '')
  const [lineas, setLineas] = useState<LineaPedido[]>(pedido?.lineas ?? [])
  const [eligiendo, setEligiendo] = useState(false)
  const [abonoInicial, setAbonoInicial] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [error, setError] = useState<string | null>(null)

  const totalNum = aNumero(total)
  const abonoNum = aNumero(abonoInicial)
  const sumaLineas = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
  const costoLineas = lineas.reduce((s, l) => s + l.cantidad * l.costoUnitario, 0)

  // Lo que hay en existencia de este negocio, contando lo que este mismo
  // pedido ya tenia apartado para poder editarlo sin que se vea agotado.
  const existencias = useMemo(() => {
    const yaEnEstePedido = new Map<string, number>()
    for (const l of pedido?.lineas ?? []) {
      if (l.articuloId) {
        yaEnEstePedido.set(l.articuloId, (yaEnEstePedido.get(l.articuloId) ?? 0) + l.cantidad)
      }
    }
    return inventarioDe(db, origenId)
      .map((e) => ({
        ...e,
        disponibles: e.disponibles + (yaEnEstePedido.get(e.articulo.id) ?? 0),
      }))
      .filter((e) => e.disponibles > 0)
  }, [db, origenId, pedido])

  function ponerLineas(siguientes: LineaPedido[]) {
    setLineas(siguientes)
    const suma = siguientes.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
    if (suma > 0) setTotal(String(Math.round(suma * 100) / 100))
  }

  function cambiarLinea(indice: number, cambios: Partial<LineaPedido>) {
    ponerLineas(lineas.map((l, i) => (i === indice ? { ...l, ...cambios } : l)))
  }

  function enviar() {
    if (!origenId) {
      setError('Elige a que negocio pertenece.')
      return
    }
    if (!(totalNum > 0)) {
      setError('El total debe ser mayor a cero.')
      return
    }
    if (abonoInicial.trim() !== '' && abonoNum > totalNum) {
      setError('El abono no puede ser mayor que el total.')
      return
    }
    setError(null)

    const datos = {
      origenId,
      tipo,
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      concepto: concepto.trim(),
      total: totalNum,
      fecha,
      estado,
      notas: notas.trim(),
      lineas: lineas.filter((l) => l.nombre.trim() && l.cantidad > 0).length
        ? lineas
            .filter((l) => l.nombre.trim() && l.cantidad > 0)
            .map((l) => ({ ...l, nombre: l.nombre.trim() }))
        : undefined,
    }

    if (pedido) {
      editarPedido(pedido.id, datos)
      onCerrar(pedido.id)
      return
    }

    const creado = agregarPedido(datos)
    if (abonoNum > 0) {
      registrarAbono(creado, { monto: abonoNum, fecha, metodo })
    }
    onCerrar(creado.id)
  }

  return (
    <Modal
      titulo={pedido ? 'Editar pedido' : 'Nuevo pedido'}
      subtitulo={AYUDA_TIPO[tipo]}
      onCerrar={() => onCerrar()}
      pie={
        <>
          <button className="btn fantasma" onClick={() => onCerrar()}>
            Cancelar
          </button>
          <button className="btn primario" onClick={enviar}>
            {pedido ? 'Guardar cambios' : 'Crear'}
          </button>
        </>
      }
    >
      <div className="tipos-mov">
        {(Object.keys(ETIQUETA_TIPO_PEDIDO) as TipoPedido[]).map((t) => (
          <button
            key={t}
            className={`tipo-mov${t === tipo ? ' activo' : ''}`}
            onClick={() => setTipo(t)}
          >
            <span>{t === 'venta' ? '💵' : t === 'separacion' ? '🔖' : '📦'}</span>
            <span>{ETIQUETA_TIPO_PEDIDO[t]}</span>
          </button>
        ))}
      </div>

      <div className="fila">
        <div className="campo">
          <label htmlFor="pd-origen">Negocio</label>
          <select id="pd-origen" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
            {activos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.emoji} {o.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pd-fecha">Fecha</label>
          <input
            id="pd-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="fila">
        <div className="campo">
          <label htmlFor="pd-cliente">Cliente</label>
          <input
            id="pd-cliente"
            type="text"
            placeholder="Nombre de quien te compra"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="pd-telefono">Telefono</label>
          <input
            id="pd-telefono"
            type="tel"
            inputMode="tel"
            placeholder="55 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="pd-concepto">Que lleva</label>
        <textarea
          id="pd-concepto"
          placeholder="Ej. Playmat edicion dragon + tubo protector"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Productos</label>
        <span className="ayuda">
          Si los eliges del inventario, el recibo sale con su detalle, la mercancia se descuenta y
          el pedido se lleva su costo real.
        </span>

        {lineas.map((l, i) => (
          <div className="articulo-fila" key={`${l.articuloId ?? 'libre'}-${i}`}>
            <div className="articulo-cab">
              <input
                type="text"
                placeholder="Producto"
                value={l.nombre}
                onChange={(e) => cambiarLinea(i, { nombre: e.target.value })}
              />
              <button
                className="btn chico fantasma"
                aria-label="Quitar producto"
                onClick={() => ponerLineas(lineas.filter((_, j) => j !== i))}
              >
                🗑️
              </button>
            </div>
            <div className="articulo-datos">
              <label>
                <span>Piezas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={l.cantidad || ''}
                  onChange={(e) => cambiarLinea(i, { cantidad: aNumero(e.target.value) })}
                />
              </label>
              <label>
                <span>Precio c/u</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={l.precioUnitario || ''}
                  onChange={(e) => cambiarLinea(i, { precioUnitario: aNumero(e.target.value) })}
                />
              </label>
              <label>
                <span>Importe</span>
                <input
                  type="text"
                  value={dinero(l.cantidad * l.precioUnitario, 0)}
                  readOnly
                  tabIndex={-1}
                />
              </label>
            </div>
          </div>
        ))}

        <div className="fila compacta" style={{ gap: 8 }}>
          <button
            className="btn chico"
            onClick={() => setEligiendo((v) => !v)}
            disabled={!existencias.length}
          >
            {existencias.length
              ? eligiendo
                ? 'Cerrar inventario'
                : `Elegir del inventario (${existencias.length})`
              : 'Sin mercancia desglosada'}
          </button>
          <button
            className="btn chico fantasma"
            onClick={() =>
              ponerLineas([
                ...lineas,
                { nombre: '', cantidad: 1, precioUnitario: 0, costoUnitario: 0 },
              ])
            }
          >
            + Renglon libre
          </button>
        </div>

        {eligiendo && (
          <div className="selector-inventario">
            {existencias.map((e) => (
              <button
                key={e.articulo.id}
                className="existencia"
                onClick={() => {
                  const yaEsta = lineas.findIndex((l) => l.articuloId === e.articulo.id)
                  if (yaEsta >= 0) {
                    cambiarLinea(yaEsta, { cantidad: lineas[yaEsta].cantidad + 1 })
                  } else {
                    ponerLineas([
                      ...lineas,
                      {
                        articuloId: e.articulo.id,
                        nombre: e.articulo.nombre,
                        cantidad: 1,
                        precioUnitario: e.articulo.precio ?? 0,
                        costoUnitario: e.articulo.costoUnitario,
                      },
                    ])
                  }
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 640, fontSize: '0.88rem' }}>{e.articulo.nombre}</div>
                  <div className="mini tenue-2">
                    quedan {e.disponibles} · costo {dinero(e.articulo.costoUnitario, 0)}
                  </div>
                </div>
                <div className="derecha">
                  <div className="num" style={{ fontWeight: 640 }}>
                    {e.articulo.precio ? dinero(e.articulo.precio, 0) : '—'}
                  </div>
                  <div className="mini tenue-2">agregar</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {lineas.length > 0 && (
          <div className="aviso-caja">
            Suman <b>{dinero(sumaLineas)}</b>
            {costoLineas > 0 && (
              <>
                {' '}
                · te costaron <b>{dinero(costoLineas)}</b> · dejas{' '}
                <b className={sumaLineas - costoLineas >= 0 ? 'pos' : 'neg'}>
                  {dinero(sumaLineas - costoLineas)}
                </b>
              </>
            )}
          </div>
        )}
      </div>

      <div className="campo">
        <label htmlFor="pd-total">Total a pagar</label>
        <div className="entrada-monto">
          <input
            id="pd-total"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
      </div>

      {!pedido && (
        <div className="fila">
          <div className="campo">
            <label htmlFor="pd-abono">Abono de hoy (opcional)</label>
            <div className="entrada-monto">
              <input
                id="pd-abono"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={abonoInicial}
                onChange={(e) => setAbonoInicial(e.target.value)}
              />
            </div>
            <span className="ayuda">Este dinero entra de una vez a la caja del negocio.</span>
          </div>
          <div className="campo">
            <label htmlFor="pd-metodo">Como te pagaron</label>
            <select
              id="pd-metodo"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPago)}
            >
              {(Object.keys(ETIQUETA_METODO) as MetodoPago[]).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_METODO[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!pedido && totalNum > 0 && abonoNum > 0 && (
        <div className="aviso-caja">
          Queda un saldo de <b>{dinero(totalNum - abonoNum)}</b>
          {abonoNum >= totalNum && ' · se marca como liquidado'}
        </div>
      )}

      {pedido && (
        <div className="campo">
          <label htmlFor="pd-estado">Estado</label>
          <select
            id="pd-estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoPedido)}
          >
            {(Object.keys(ETIQUETA_ESTADO_PEDIDO) as EstadoPedido[]).map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_PEDIDO[e]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="campo">
        <label htmlFor="pd-notas">Notas (opcional)</label>
        <textarea
          id="pd-notas"
          placeholder="Detalles del acuerdo, fecha prometida, lo que sea"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {error && (
        <div className="alerta peligro">
          <span className="alerta-icono">⚠️</span>
          <div className="alerta-titulo">{error}</div>
        </div>
      )}
    </Modal>
  )
}
