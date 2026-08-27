import { useState } from 'react'
import type { MetodoPago, Movimiento, Pedido } from '../tipos'
import { ETIQUETA_METODO } from '../tipos'
import { useTienda } from '../estado/tienda'
import { estadoDeCuenta } from '../lib/calculos'
import { aNumero, dinero } from '../lib/formato'
import { hoy } from '../lib/fechas'
import { Modal } from './ui'

export function FormAbono({
  pedido,
  onCerrar,
}: {
  pedido: Pedido
  /** Recibe el abono creado para poder abrir su recibo enseguida. */
  onCerrar: (abono?: Movimiento) => void
}) {
  const { db, registrarAbono } = useTienda()
  const cuenta = estadoDeCuenta(pedido, db.movimientos)

  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const montoNum = aNumero(monto)
  const saldoDespues = cuenta.saldo - montoNum

  function enviar() {
    if (!(montoNum > 0)) {
      setError('El abono debe ser mayor a cero.')
      return
    }
    setError(null)
    const abono = registrarAbono(pedido, {
      monto: montoNum,
      fecha,
      metodo,
      nota: nota.trim() || undefined,
    })
    onCerrar(abono)
  }

  return (
    <Modal
      titulo="Registrar abono"
      subtitulo={`${pedido.cliente || 'Cliente'} · saldo actual ${dinero(Math.max(cuenta.saldo, 0))}`}
      onCerrar={() => onCerrar()}
      pie={
        <>
          <button className="btn fantasma" onClick={() => onCerrar()}>
            Cancelar
          </button>
          <button className="btn primario" onClick={enviar}>
            Guardar y ver recibo
          </button>
        </>
      }
    >
      <div className="campo">
        <label htmlFor="ab-monto">¿Cuanto te abonaron?</label>
        <div className="entrada-monto">
          <input
            id="ab-monto"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        {cuenta.saldo > 0 && (
          <button
            className="btn chico fantasma"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setMonto(String(Math.round(cuenta.saldo * 100) / 100))}
          >
            Liquidar todo ({dinero(cuenta.saldo, 0)})
          </button>
        )}
      </div>

      <div className="fila">
        <div className="campo">
          <label htmlFor="ab-fecha">Fecha</label>
          <input
            id="ab-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="ab-metodo">Como te pagaron</label>
          <select
            id="ab-metodo"
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

      {montoNum > 0 && (
        <div className="aviso-caja">
          {saldoDespues <= 0.005 ? (
            <>
              Con esto queda <b className="pos">liquidado</b>
              {saldoDespues < -0.005 && ` (te pagaron ${dinero(-saldoDespues)} de mas)`}
            </>
          ) : (
            <>
              Quedaria un saldo de <b>{dinero(saldoDespues)}</b>
            </>
          )}
        </div>
      )}

      <div className="campo">
        <label htmlFor="ab-nota">Nota (opcional)</label>
        <input
          id="ab-nota"
          type="text"
          placeholder="Referencia de la transferencia, quien recibio…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
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
