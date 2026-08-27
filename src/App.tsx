import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProveedorTienda, useTienda } from './estado/tienda'
import { calcular, movimientosDe, type Rango } from './lib/calculos'
import { construirRango } from './lib/rangos'
import { dineroCorto } from './lib/formato'
import { hayNube } from './lib/nube'
import type { TipoMovimiento } from './tipos'
import { SelectorRango } from './componentes/SelectorRango'
import { FormMovimiento } from './componentes/FormMovimiento'
import { FormOrigen } from './componentes/FormOrigen'
import { AvatarOrigen } from './componentes/AvatarOrigen'
import { EstadoNube } from './componentes/EstadoNube'
import { Acceso, NuevaClave } from './vistas/Acceso'
import { FormPedido } from './componentes/FormPedido'
import { Panel } from './vistas/Panel'
import { Pedidos } from './vistas/Pedidos'
import { DetallePedido } from './vistas/DetallePedido'
import { DetalleOrigen } from './vistas/DetalleOrigen'
import { Movimientos } from './vistas/Movimientos'
import { Comparar } from './vistas/Comparar'
import { Ajustes } from './vistas/Ajustes'

type Vista =
  | { tipo: 'panel' }
  | { tipo: 'pedidos' }
  | { tipo: 'movimientos' }
  | { tipo: 'comparar' }
  | { tipo: 'ajustes' }
  | { tipo: 'origen'; id: string }
  | { tipo: 'pedido'; id: string }

const TITULOS: Record<Vista['tipo'], { titulo: string; sub: string }> = {
  panel: { titulo: 'Panel', sub: 'Como van todos tus negocios juntos' },
  pedidos: { titulo: 'Pedidos', sub: 'Separaciones, encargos y sus recibos' },
  movimientos: { titulo: 'Movimientos', sub: 'Todo lo que ha entrado y salido' },
  comparar: { titulo: 'Comparar', sub: 'A cual conviene meterle mas' },
  ajustes: { titulo: 'Ajustes', sub: 'Cuenta, respaldo y preferencias' },
  origen: { titulo: 'Origen', sub: '' },
  pedido: { titulo: 'Pedido', sub: '' },
}

const PESTANIAS: Array<{ id: Vista['tipo']; icono: string; etiqueta: string }> = [
  { id: 'panel', icono: '📊', etiqueta: 'Panel' },
  { id: 'pedidos', icono: '🧾', etiqueta: 'Pedidos' },
  { id: 'movimientos', icono: '📋', etiqueta: 'Movs' },
  { id: 'comparar', icono: '⚖️', etiqueta: 'Comparar' },
  { id: 'ajustes', icono: '⚙️', etiqueta: 'Ajustes' },
]

function leerHash(): Vista {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h.startsWith('origen/')) return { tipo: 'origen', id: h.slice(7) }
  if (h.startsWith('pedido/')) return { tipo: 'pedido', id: h.slice(7) }
  if (h === 'movimientos' || h === 'comparar' || h === 'ajustes' || h === 'pedidos')
    return { tipo: h }
  return { tipo: 'panel' }
}

function escribirHash(v: Vista) {
  const destino =
    v.tipo === 'origen' || v.tipo === 'pedido' ? `#/${v.tipo}/${v.id}` : `#/${v.tipo}`
  if (window.location.hash !== destino) window.location.hash = destino
}

function Aplicacion() {
  const { db, vacio, errorGuardado, sesion, sesionExpirada, autenticando, recuperandoClave, salir } =
    useTienda()
  const [vista, setVista] = useState<Vista>(() => leerHash())
  const [rango, setRango] = useState<Rango>(() => construirRango('mes'))
  const [formMovimiento, setFormMovimiento] = useState<
    { abierto: false } | { abierto: true; origenId?: string; tipo?: TipoMovimiento }
  >({ abierto: false })
  const [formOrigen, setFormOrigen] = useState(false)
  const [formPedido, setFormPedido] = useState(false)

  const ir = useCallback((v: Vista) => {
    setVista(v)
    escribirHash(v)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const alCambiar = () => setVista(leerHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  useEffect(() => {
    const raiz = document.documentElement
    if (db.config.tema === 'auto') raiz.removeAttribute('data-tema')
    else raiz.setAttribute('data-tema', db.config.tema)
  }, [db.config.tema])

  useEffect(() => {
    document.title = sesion ? `${db.config.nombre} · AdminVUrslef` : 'AdminVUrslef'
  }, [db.config.nombre, sesion])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null
      const escribiendo =
        objetivo &&
        (objetivo.tagName === 'INPUT' ||
          objetivo.tagName === 'TEXTAREA' ||
          objetivo.tagName === 'SELECT' ||
          objetivo.isContentEditable)
      if (escribiendo || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' && db.origenes.length) {
        e.preventDefault()
        setFormMovimiento({ abierto: true })
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [db.origenes.length])

  const pedidosAbiertos = useMemo(
    () => db.pedidos.filter((p) => p.estado === 'abierto').length,
    [db.pedidos],
  )

  const saldos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const o of db.origenes) {
      mapa.set(o.id, calcular(movimientosDe(db.movimientos, o.id), db.categorias, o.id).caja)
    }
    return mapa
  }, [db.origenes, db.movimientos, db.categorias])

  if (autenticando) {
    return (
      <div className="pantalla-acceso">
        <div className="caja-acceso centro">
          <div className="marca-logo" style={{ margin: '0 auto' }}>
            AV
          </div>
          <p className="tenue">Abriendo tus negocios…</p>
        </div>
      </div>
    )
  }

  if (hayNube && recuperandoClave) return <NuevaClave />
  // Con la sesion caducada NO se cierra la puerta: los datos siguen en el
  // telefono y se puede seguir capturando. Solo se avisa para volver a entrar.
  if (hayNube && !sesion && !sesionExpirada) return <Acceso />

  const origenActual =
    vista.tipo === 'origen' ? db.origenes.find((o) => o.id === vista.id) : undefined
  const pedidoActual =
    vista.tipo === 'pedido' ? db.pedidos.find((p) => p.id === vista.id) : undefined
  const encabezado =
    vista.tipo === 'origen'
      ? { titulo: origenActual?.nombre ?? 'Origen', sub: 'Estadisticas e historial' }
      : vista.tipo === 'pedido'
        ? { titulo: pedidoActual?.cliente || 'Pedido', sub: 'Abonos y recibos' }
        : TITULOS[vista.tipo]

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <div className="marca-logo">AV</div>
          <div style={{ minWidth: 0 }}>
            <div className="marca-nombre">{db.config.nombre}</div>
            <div className="marca-sub">AdminVUrslef</div>
          </div>
        </div>

        <nav className="nav">
          {PESTANIAS.map((n) => (
            <button
              key={n.id}
              className={`nav-item${vista.tipo === n.id ? ' activo' : ''}`}
              onClick={() => ir({ tipo: n.id } as Vista)}
            >
              <span className="nav-icono">{n.icono}</span>
              {n.id === 'movimientos' ? 'Movimientos' : n.etiqueta}
              {n.id === 'movimientos' && (
                <span className="nav-conteo">{db.movimientos.length}</span>
              )}
              {n.id === 'pedidos' && pedidosAbiertos > 0 && (
                <span className="nav-conteo">{pedidosAbiertos}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="nav">
          <div className="nav-titulo">Origenes</div>
          <div className="lateral-origenes">
            {db.origenes
              .filter((o) => !o.archivado)
              .map((o) => (
                <button
                  key={o.id}
                  className={`chip-origen${
                    vista.tipo === 'origen' && vista.id === o.id ? ' activo' : ''
                  }`}
                  onClick={() => ir({ tipo: 'origen', id: o.id })}
                >
                  <AvatarOrigen origen={o} tamano={20} />
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {o.nombre}
                  </span>
                  <span className="chip-origen-saldo">{dineroCorto(saldos.get(o.id) ?? 0)}</span>
                </button>
              ))}
            <button className="chip-origen" onClick={() => setFormOrigen(true)}>
              <i className="punto" style={{ background: 'var(--borde-fuerte)' }} />
              Nuevo origen
            </button>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '0 8px' }}>
          <button
            className="btn primario bloque"
            onClick={() => setFormMovimiento({ abierto: true })}
            disabled={vacio}
          >
            + Registrar movimiento
          </button>
          <p className="mini tenue-2 centro" style={{ marginTop: 8 }}>
            Atajo: tecla <b>N</b>
          </p>
        </div>
      </aside>

      <main className="principal">
        {sesionExpirada && (
          <div className="banda-error">
            Tu sesion caduco. Puedes seguir capturando: se guarda en el telefono.{' '}
            <button
              className="btn chico"
              style={{ marginLeft: 8 }}
              onClick={() => void salir()}
            >
              Entrar de nuevo
            </button>
          </div>
        )}
        {errorGuardado && <div className="banda-error">{errorGuardado}</div>}

        {/* Encabezado y rango van juntos en UN solo bloque pegajoso: cuando
            eran dos sticky al mismo top se encimaban al desplazar. */}
        <div className="cabecera-fija">
          <header className="barra">
            <div className="barra-titulo">
              <h1 style={{ fontSize: '1.18rem' }}>
                {vista.tipo === 'origen' && origenActual ? `${origenActual.emoji} ` : ''}
              {vista.tipo === 'pedido' && pedidoActual
                ? pedidoActual.tipo === 'venta'
                  ? '💵 '
                  : pedidoActual.tipo === 'separacion'
                    ? '🔖 '
                    : '📦 '
                : ''}
                {encabezado.titulo}
              </h1>
              <span className="mini tenue">{encabezado.sub}</span>
            </div>
            <div className="barra-acciones">
              <EstadoNube />
              <button
                className="btn primario solo-escritorio"
                onClick={() => setFormMovimiento({ abierto: true })}
                disabled={vacio}
              >
                + Registrar
              </button>
            </div>
          </header>

          {/* El rango solo manda donde hay estadisticas por periodo. */}
          {vista.tipo !== 'ajustes' &&
            vista.tipo !== 'pedidos' &&
            vista.tipo !== 'pedido' && (
            <div className="barra-rango">
              <SelectorRango rango={rango} onCambio={setRango} />
            </div>
          )}
        </div>

        <div className="contenido">
          {vista.tipo === 'panel' && (
            <Panel
              rango={rango}
              onAbrirOrigen={(id) => ir({ tipo: 'origen', id })}
              onNuevoOrigen={() => setFormOrigen(true)}
              onNuevoMovimiento={() => setFormMovimiento({ abierto: true })}
              onVerMovimientos={() => ir({ tipo: 'movimientos' })}
              onVerPedidos={() => ir({ tipo: 'pedidos' })}
            />
          )}
          {vista.tipo === 'movimientos' && (
            <Movimientos
              rango={rango}
              onNuevoMovimiento={() => setFormMovimiento({ abierto: true })}
            />
          )}
          {vista.tipo === 'comparar' && (
            <Comparar rango={rango} onAbrirOrigen={(id) => ir({ tipo: 'origen', id })} />
          )}
          {vista.tipo === 'pedidos' && (
            <Pedidos
              onAbrirPedido={(id) => ir({ tipo: 'pedido', id })}
              onNuevoPedido={() => setFormPedido(true)}
            />
          )}
          {vista.tipo === 'pedido' && (
            <DetallePedido
              pedidoId={vista.id}
              onSalir={() => ir({ tipo: 'pedidos' })}
              onAbrirOrigen={(id) => ir({ tipo: 'origen', id })}
            />
          )}
          {vista.tipo === 'ajustes' && <Ajustes />}
          {vista.tipo === 'origen' && (
            <DetalleOrigen
              origenId={vista.id}
              rango={rango}
              onNuevoMovimiento={(id) => setFormMovimiento({ abierto: true, origenId: id })}
              onSalir={() => ir({ tipo: 'panel' })}
            />
          )}
        </div>
      </main>

      {/* Navegacion de celular: al alcance del pulgar */}
      <nav className="barra-inferior">
        {PESTANIAS.slice(0, 2).map((p) => (
          <button
            key={p.id}
            className={`tab${vista.tipo === p.id ? ' activo' : ''}`}
            onClick={() => ir({ tipo: p.id } as Vista)}
          >
            <span className="tab-icono">{p.icono}</span>
            {p.etiqueta}
          </button>
        ))}
        <button
          className="tab-central"
          onClick={() => setFormMovimiento({ abierto: true })}
          disabled={vacio}
          aria-label="Registrar movimiento"
        >
          +
        </button>
        {PESTANIAS.slice(2).map((p) => (
          <button
            key={p.id}
            className={`tab${vista.tipo === p.id ? ' activo' : ''}`}
            onClick={() => ir({ tipo: p.id } as Vista)}
          >
            <span className="tab-icono">{p.icono}</span>
            {p.etiqueta}
          </button>
        ))}
      </nav>

      {formMovimiento.abierto && (
        <FormMovimiento
          origenInicial={formMovimiento.origenId}
          tipoInicial={formMovimiento.tipo}
          onCerrar={() => setFormMovimiento({ abierto: false })}
        />
      )}
      {formOrigen && (
        <FormOrigen
          onCerrar={(id) => {
            setFormOrigen(false)
            if (id) ir({ tipo: 'origen', id })
          }}
        />
      )}
      {formPedido && (
        <FormPedido
          origenInicial={vista.tipo === 'origen' ? vista.id : undefined}
          onCerrar={(id) => {
            setFormPedido(false)
            if (id) ir({ tipo: 'pedido', id })
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ProveedorTienda>
      <Aplicacion />
    </ProveedorTienda>
  )
}
