import { useMemo, useState } from 'react'
import type { Movimiento, TipoMovimiento } from '../tipos'
import { useTienda } from '../estado/tienda'
import { calcular, movimientosDe } from '../lib/calculos'
import { dinero, aNumero, porcentaje } from '../lib/formato'
import { hoy, sumarDias } from '../lib/fechas'
import { Modal } from './ui'

const TIPOS: Array<{ id: TipoMovimiento; icono: string; etiqueta: string; ayuda: string }> = [
  {
    id: 'venta',
    icono: '💰',
    etiqueta: 'Venta',
    ayuda: 'Dinero que entra por vender un producto o un servicio.',
  },
  {
    id: 'gasto',
    icono: '🧾',
    etiqueta: 'Gasto',
    ayuda: 'Dinero que sale para operar: mercancia, envios, publicidad, comisiones...',
  },
  {
    id: 'retiro',
    icono: '🏦',
    etiqueta: 'Retiro',
    ayuda: 'Dinero que sacas del negocio para ti. Aqui se ve en que se te va lo ganado.',
  },
  {
    id: 'aporte',
    icono: '➕',
    etiqueta: 'Aporte',
    ayuda: 'Capital que le METES al origen desde fuera. Es la base para calcular el ROI.',
  },
  {
    id: 'traspaso',
    icono: '🔁',
    etiqueta: 'Traspaso',
    ayuda: 'Mueves dinero de un origen a otro. Sale de uno y entra al otro.',
  },
  {
    id: 'ajuste',
    icono: '⚖️',
    etiqueta: 'Ajuste',
    ayuda: 'Cuadra la caja cuando el saldo de la app no coincide con el dinero real.',
  },
]

interface Props {
  movimiento?: Movimiento
  origenInicial?: string
  tipoInicial?: TipoMovimiento
  onCerrar: () => void
}

export function FormMovimiento({ movimiento, origenInicial, tipoInicial, onCerrar }: Props) {
  const { db, agregarMovimiento, editarMovimiento } = useTienda()
  const activos = db.origenes.filter((o) => !o.archivado || o.id === movimiento?.origenId)

  const [tipo, setTipo] = useState<TipoMovimiento>(
    movimiento?.tipo ?? tipoInicial ?? 'venta',
  )
  const [origenId, setOrigenId] = useState(
    movimiento?.origenId ?? origenInicial ?? activos[0]?.id ?? '',
  )
  const [destinoId, setDestinoId] = useState(movimiento?.destinoId ?? '')
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoy())
  const [monto, setMonto] = useState(movimiento ? String(Math.abs(movimiento.monto)) : '')
  const [costo, setCosto] = useState(movimiento?.costo != null ? String(movimiento.costo) : '')
  const [retorno, setRetorno] = useState(
    movimiento?.retornoEsperado != null ? String(movimiento.retornoEsperado) : '',
  )
  const [concepto, setConcepto] = useState(movimiento?.concepto ?? '')
  const [categoria, setCategoria] = useState(movimiento?.categoria ?? '')
  const [nota, setNota] = useState(movimiento?.nota ?? '')
  const [saldoReal, setSaldoReal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string | null>(null)

  const cajaActual = useMemo(() => {
    if (!origenId) return 0
    return calcular(movimientosDe(db.movimientos, origenId), db.categorias, origenId).caja
  }, [db.movimientos, db.categorias, origenId])

  const categorias = db.categorias.filter((c) =>
    tipo === 'retiro' ? c.ambito === 'retiro' : c.ambito === 'gasto',
  )

  const montoNum = aNumero(monto)
  const costoNum = aNumero(costo)
  const retornoNum = aNumero(retorno)
  const gananciaEsperada = retornoNum - montoNum
  const margenEsperado = retornoNum > 0 ? (gananciaEsperada / retornoNum) * 100 : null
  const gananciaPreview = montoNum - costoNum
  const margenPreview = montoNum > 0 ? (gananciaPreview / montoNum) * 100 : null
  const deltaAjuste = aNumero(saldoReal) - cajaActual

  const catInventario = db.categorias.find((c) => c.id === categoria)?.inventario

  function limpiar() {
    setMonto('')
    setCosto('')
    setRetorno('')
    setConcepto('')
    setNota('')
    setSaldoReal('')
  }

  function validar(): string | null {
    if (!origenId) return 'Elige a que origen pertenece este movimiento.'
    if (tipo === 'traspaso') {
      if (!destinoId) return 'Elige el origen que recibe el dinero.'
      if (destinoId === origenId) return 'El origen que envia y el que recibe no pueden ser el mismo.'
    }
    if (tipo === 'ajuste') {
      if (saldoReal.trim() === '') return 'Escribe cuanto dinero hay realmente en la caja.'
      if (Math.abs(deltaAjuste) < 0.005) return 'El saldo real ya coincide con el de la app.'
      return null
    }
    if (!(montoNum > 0)) return 'El monto debe ser mayor a cero.'
    if (tipo === 'venta' && costo.trim() !== '' && costoNum < 0) return 'El costo no puede ser negativo.'
    return null
  }

  function enviar(seguirCapturando: boolean) {
    const problema = validar()
    if (problema) {
      setError(problema)
      return
    }
    setError(null)

    const datos = {
      tipo,
      origenId,
      destinoId: tipo === 'traspaso' ? destinoId : undefined,
      fecha,
      monto: tipo === 'ajuste' ? deltaAjuste : montoNum,
      costo: tipo === 'venta' && costo.trim() !== '' ? costoNum : undefined,
      retornoEsperado:
        tipo === 'gasto' && catInventario && retorno.trim() !== '' ? retornoNum : undefined,
      concepto: concepto.trim() || textoPorDefecto(tipo),
      categoria: tipo === 'gasto' || tipo === 'retiro' ? categoria || undefined : undefined,
      nota: nota.trim() || undefined,
    }

    if (movimiento) {
      editarMovimiento(movimiento.id, datos)
      onCerrar()
      return
    }

    agregarMovimiento(datos)
    if (seguirCapturando) {
      setGuardado(`Registrado: ${datos.concepto}`)
      limpiar()
      setTimeout(() => setGuardado(null), 2600)
    } else {
      onCerrar()
    }
  }

  const info = TIPOS.find((t) => t.id === tipo)!

  return (
    <Modal
      titulo={movimiento ? 'Editar movimiento' : 'Registrar movimiento'}
      subtitulo={info.ayuda}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          {!movimiento && (
            <button className="btn" onClick={() => enviar(true)}>
              Guardar y seguir
            </button>
          )}
          <button className="btn primario" onClick={() => enviar(false)}>
            {movimiento ? 'Guardar cambios' : 'Guardar'}
          </button>
        </>
      }
    >
      {!movimiento && (
        <div className="tipos-mov">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              className={`tipo-mov${t.id === tipo ? ' activo' : ''}`}
              onClick={() => {
                setTipo(t.id)
                setError(null)
              }}
            >
              <span>{t.icono}</span>
              <span>{t.etiqueta}</span>
            </button>
          ))}
        </div>
      )}

      <div className="fila">
        <div className="campo">
          <label htmlFor="mov-origen">{tipo === 'traspaso' ? 'Sale de' : 'Origen'}</label>
          <select
            id="mov-origen"
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
          >
            {activos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.emoji} {o.nombre}
              </option>
            ))}
          </select>
        </div>

        {tipo === 'traspaso' && (
          <div className="campo">
            <label htmlFor="mov-destino">Entra a</label>
            <select
              id="mov-destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              <option value="">Elige un origen…</option>
              {activos
                .filter((o) => o.id !== origenId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.emoji} {o.nombre}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="campo" style={{ flex: '0 1 175px' }}>
          <label htmlFor="mov-fecha">Fecha</label>
          <input
            id="mov-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="btn chico fantasma" onClick={() => setFecha(hoy())}>
              Hoy
            </button>
            <button className="btn chico fantasma" onClick={() => setFecha(sumarDias(hoy(), -1))}>
              Ayer
            </button>
          </div>
        </div>
      </div>

      {tipo === 'ajuste' ? (
        <>
          <div className="aviso-caja">
            La app dice que en <b>{db.origenes.find((o) => o.id === origenId)?.nombre}</b> hay{' '}
            <b className="num">{dinero(cajaActual)}</b>.
          </div>
          <div className="campo">
            <label htmlFor="mov-real">¿Cuanto dinero hay realmente?</label>
            <div className="entrada-monto">
              <input
                id="mov-real"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={saldoReal}
                onChange={(e) => setSaldoReal(e.target.value)}
              />
            </div>
            {saldoReal.trim() !== '' && (
              <span className="ayuda">
                Se registrara un ajuste de{' '}
                <b className={deltaAjuste >= 0 ? 'pos' : 'neg'}>
                  {deltaAjuste >= 0 ? '+' : ''}
                  {dinero(deltaAjuste)}
                </b>
                .
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="fila">
          <div className="campo">
            <label htmlFor="mov-monto">
              {tipo === 'venta' ? 'En cuanto lo vendiste' : 'Monto'}
            </label>
            <div className="entrada-monto">
              <input
                id="mov-monto"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                autoFocus
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          {tipo === 'venta' && (
            <div className="campo">
              <label htmlFor="mov-costo">Cuanto te costo a ti (opcional)</label>
              <div className="entrada-monto">
                <input
                  id="mov-costo"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                />
              </div>
              <span className="ayuda">Solo sirve para el margen; el dinero ya salio cuando compraste.</span>
            </div>
          )}
        </div>
      )}

      {tipo === 'venta' && montoNum > 0 && costo.trim() !== '' && (
        <div className="aviso-caja">
          Ganas <b className={gananciaPreview >= 0 ? 'pos' : 'neg'}>{dinero(gananciaPreview)}</b> en
          esta venta · margen <b>{porcentaje(margenPreview)}</b>
          {margenPreview !== null && margenPreview < db.config.margenObjetivo && (
            <span className="neg"> · debajo de tu objetivo de {db.config.margenObjetivo}%</span>
          )}
        </div>
      )}

      {(tipo === 'gasto' || tipo === 'retiro') && (
        <div className="campo">
          <label htmlFor="mov-categoria">Categoria</label>
          <select
            id="mov-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Sin categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.inventario ? ' (mercancia)' : ''}
              </option>
            ))}
          </select>
          {tipo === 'gasto' && catInventario && (
            <span className="ayuda">
              Marcada como mercancia: este dinero no se cuenta como perdida, se vuelve inventario y
              regresa cuando lo vendas.
            </span>
          )}
        </div>
      )}

      {tipo === 'gasto' && catInventario && (
        <>
          <div className="campo">
            <label htmlFor="mov-retorno">¿En cuanto esperas venderlo? (opcional)</label>
            <div className="entrada-monto">
              <input
                id="mov-retorno"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={retorno}
                onChange={(e) => setRetorno(e.target.value)}
              />
            </div>
            <span className="ayuda">
              Con esto la app puede decirte cuanta ganancia sigue guardada en la mercancia que aun
              no vendes, y avisarte si terminas vendiendo mas barato de lo que planeabas.
            </span>
          </div>

          {montoNum > 0 && retorno.trim() !== '' && (
            <div className="aviso-caja">
              Si se vende completo ganas{' '}
              <b className={gananciaEsperada >= 0 ? 'pos' : 'neg'}>{dinero(gananciaEsperada)}</b> ·
              margen esperado <b>{porcentaje(margenEsperado)}</b>
              {margenEsperado !== null && margenEsperado < db.config.margenObjetivo && (
                <span className="neg"> · debajo de tu objetivo de {db.config.margenObjetivo}%</span>
              )}
            </div>
          )}
        </>
      )}

      <div className="campo">
        <label htmlFor="mov-concepto">Concepto</label>
        <input
          id="mov-concepto"
          type="text"
          placeholder={textoPorDefecto(tipo)}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor="mov-nota">Nota (opcional)</label>
        <textarea
          id="mov-nota"
          placeholder="Cliente, forma de pago, lo que quieras recordar…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      {error && <div className="alerta peligro"><span className="alerta-icono">⚠️</span><div><div className="alerta-titulo">{error}</div></div></div>}
      {guardado && <div className="alerta bien"><span className="alerta-icono">✅</span><div><div className="alerta-titulo">{guardado}</div><div className="alerta-detalle">Puedes capturar el siguiente sin cerrar.</div></div></div>}
    </Modal>
  )
}

function textoPorDefecto(tipo: TipoMovimiento): string {
  switch (tipo) {
    case 'venta': return 'Venta'
    case 'gasto': return 'Gasto'
    case 'retiro': return 'Retiro'
    case 'aporte': return 'Aporte de capital'
    case 'traspaso': return 'Traspaso entre origenes'
    case 'ajuste': return 'Ajuste de caja'
  }
}
