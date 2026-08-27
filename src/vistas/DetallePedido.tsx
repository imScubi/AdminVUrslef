import { useMemo, useState } from 'react'
import { useTienda } from '../estado/tienda'
import { costoDePedido, estadoDeCuenta } from '../lib/calculos'
import { dinero, porcentaje } from '../lib/formato'
import { fechaLegible } from '../lib/fechas'
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_METODO,
  ETIQUETA_TIPO_PEDIDO,
  type Movimiento,
} from '../tipos'
import { BarraProgreso, Confirmar, Metrica, Vacio } from '../componentes/ui'
import { FormPedido } from '../componentes/FormPedido'
import { FormAbono } from '../componentes/FormAbono'
import { Recibo } from '../componentes/Recibo'

/** Deja el telefono como lo quiere WhatsApp: solo digitos, con lada. */
function paraWhatsapp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.length === 10 ? `52${digitos}` : digitos
}

export function DetallePedido({
  pedidoId,
  onSalir,
  onAbrirOrigen,
}: {
  pedidoId: string
  onSalir: () => void
  onAbrirOrigen: (id: string) => void
}) {
  const { db, editarPedido, borrarPedido } = useTienda()
  const [editando, setEditando] = useState(false)
  const [abonando, setAbonando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [recibo, setRecibo] = useState<{ abono?: Movimiento } | null>(null)

  const pedido = db.pedidos.find((p) => p.id === pedidoId)
  const origen = db.origenes.find((o) => o.id === pedido?.origenId)
  const cuenta = useMemo(
    () => (pedido ? estadoDeCuenta(pedido, db.movimientos) : null),
    [pedido, db.movimientos],
  )

  if (!pedido || !cuenta) {
    return (
      <Vacio
        icono="🔍"
        titulo="Ese pedido ya no existe"
        accion={
          <button className="btn" onClick={onSalir}>
            Volver a pedidos
          </button>
        }
      />
    )
  }

  const wa = paraWhatsapp(pedido.telefono)
  const costo = costoDePedido(pedido)
  const ganancia = pedido.total - costo
  const margen = pedido.total > 0 ? (ganancia / pedido.total) * 100 : null

  return (
    <>
      <div
        className="cabecera-origen"
        style={{ ['--color-origen' as string]: origen?.color ?? 'var(--acento)' }}
      >
        <div className="avatar-origen" style={{ background: `${origen?.color ?? '#666'}22` }}>
          {pedido.tipo === 'venta' ? '💵' : pedido.tipo === 'separacion' ? '🔖' : '📦'}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1>{pedido.cliente || 'Sin nombre'}</h1>
          <div
            className="mini tenue"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <span className="pill">{ETIQUETA_TIPO_PEDIDO[pedido.tipo]}</span>
            <span
              className={`pill ${
                pedido.estado === 'liquidado'
                  ? 'verde'
                  : pedido.estado === 'cancelado'
                    ? 'rojo'
                    : 'ambar'
              }`}
            >
              {ETIQUETA_ESTADO_PEDIDO[pedido.estado]}
            </span>
            {origen && (
              <button
                className="btn chico fantasma"
                onClick={() => onAbrirOrigen(origen.id)}
                style={{ padding: '2px 6px' }}
              >
                <i className="punto" style={{ background: origen.color }} /> {origen.nombre}
              </button>
            )}
            <span>{fechaLegible(pedido.fecha)}</span>
          </div>
        </div>
        <div className="barra-acciones">
          {pedido.telefono.trim() && (
            <>
              <a className="btn chico" href={`tel:${pedido.telefono.replace(/\s/g, '')}`}>
                Llamar
              </a>
              {wa && (
                <a
                  className="btn chico"
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              )}
            </>
          )}
          <button className="btn chico" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button className="btn chico peligro" onClick={() => setBorrando(true)}>
            Borrar
          </button>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Estado de la cuenta</h2>
          <div className="barra-acciones">
            <button className="btn chico" onClick={() => setRecibo({})}>
              Ver estado de cuenta
            </button>
            {pedido.estado !== 'cancelado' && (
              <button className="btn chico primario" onClick={() => setAbonando(true)}>
                + Abono
              </button>
            )}
          </div>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={costo > 0 ? 'rejilla c4' : 'rejilla c3'}>
            <Metrica mediana etiqueta="Total" valor={dinero(pedido.total)} />
            <Metrica mediana etiqueta="Abonado" valor={dinero(cuenta.abonado)} tono="pos" />
            <Metrica
              mediana
              etiqueta="Saldo"
              valor={dinero(Math.max(cuenta.saldo, 0))}
              tono={cuenta.liquidado ? 'pos' : 'neg'}
              pie={cuenta.liquidado ? 'Pagado por completo' : `${porcentaje(cuenta.avance, 0)} cubierto`}
            />
            {costo > 0 && (
              <Metrica
                mediana
                etiqueta="Te deja"
                valor={dinero(ganancia)}
                tono={ganancia >= 0 ? 'pos' : 'neg'}
                pie={`Costo ${dinero(costo, 0)} · margen ${porcentaje(margen, 0)}`}
                ayuda="Total menos lo que te costo. El costo se va reconociendo conforme te van pagando."
              />
            )}
          </div>
          <BarraProgreso
            valor={cuenta.avance}
            color={cuenta.liquidado ? 'var(--verde)' : (origen?.color ?? 'var(--acento)')}
          />
          {pedido.concepto.trim() && (
            <div>
              <div
                className="mini tenue-2"
                style={{ fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Que lleva
              </div>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{pedido.concepto}</p>
            </div>
          )}
          {pedido.notas.trim() && (
            <div>
              <div
                className="mini tenue-2"
                style={{ fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Notas
              </div>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }} className="tenue">
                {pedido.notas}
              </p>
            </div>
          )}
          {pedido.estado === 'abierto' && cuenta.liquidado && (
            <button
              className="btn"
              onClick={() => editarPedido(pedido.id, { estado: 'liquidado' })}
            >
              Marcar como liquidado
            </button>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Abonos</h2>
          <span className="mini tenue">{cuenta.abonos.length} registrados</span>
        </div>
        {cuenta.abonos.length === 0 ? (
          <div className="tarjeta-cuerpo">
            <p className="mini tenue">
              Todavia no hay abonos. Cuando registres el primero se genera su recibo y el dinero
              entra a la caja de {origen?.nombre ?? 'este negocio'}.
            </p>
          </div>
        ) : (
          <div>
            {[...cuenta.abonos].reverse().map((a) => (
              <div className="movimiento" key={a.id}>
                <div
                  className="mov-icono"
                  style={{ background: 'var(--verde-suave)', color: 'var(--verde)' }}
                >
                  🧾
                </div>
                <div className="mov-cuerpo">
                  <div className="mov-concepto">
                    {a.folio ? `Recibo #${String(a.folio).padStart(4, '0')}` : 'Abono'}
                  </div>
                  <div className="mov-meta">
                    <span>{fechaLegible(a.fecha)}</span>
                    {a.metodo && <span className="pill">{ETIQUETA_METODO[a.metodo]}</span>}
                    {a.nota && <span title={a.nota}>📝</span>}
                  </div>
                </div>
                <div className="mov-monto pos">{dinero(a.monto)}</div>
                <button className="btn chico" onClick={() => setRecibo({ abono: a })}>
                  Recibo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <FormPedido pedido={pedido} onCerrar={() => setEditando(false)} />
      )}
      {abonando && (
        <FormAbono
          pedido={pedido}
          onCerrar={(abono) => {
            setAbonando(false)
            if (abono) setRecibo({ abono })
          }}
        />
      )}
      {recibo && origen && (
        <Recibo
          pedido={pedido}
          origen={origen}
          movimientos={db.movimientos}
          abono={recibo.abono}
          onCerrar={() => setRecibo(null)}
        />
      )}
      {borrando && (
        <Confirmar
          titulo="Borrar pedido"
          mensaje={`Se borra el pedido de ${pedido.cliente || 'este cliente'} y tambien los ${cuenta.abonos.length} abono(s) que entraron por el, asi que la caja del negocio va a bajar ${dinero(cuenta.abonado)}.`}
          textoConfirmar="Borrar todo"
          onCancelar={() => setBorrando(false)}
          onConfirmar={() => {
            borrarPedido(pedido.id)
            setBorrando(false)
            onSalir()
          }}
        />
      )}
    </>
  )
}
