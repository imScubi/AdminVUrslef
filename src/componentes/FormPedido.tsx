import { useState } from 'react'
import type { EstadoPedido, MetodoPago, Pedido, TipoPedido } from '../tipos'
import { ETIQUETA_ESTADO_PEDIDO, ETIQUETA_METODO, ETIQUETA_TIPO_PEDIDO } from '../tipos'
import { useTienda } from '../estado/tienda'
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
  const [abonoInicial, setAbonoInicial] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [error, setError] = useState<string | null>(null)

  const totalNum = aNumero(total)
  const abonoNum = aNumero(abonoInicial)

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
