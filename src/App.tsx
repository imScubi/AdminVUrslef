import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProveedorTienda, useTienda } from './estado/tienda'
import { calcular, movimientosDe, type Rango } from './lib/calculos'
import { construirRango } from './lib/rangos'
import { dineroCorto } from './lib/formato'
import type { TipoMovimiento } from './tipos'
import { SelectorRango } from './componentes/SelectorRango'
import { FormMovimiento } from './componentes/FormMovimiento'
import { FormOrigen } from './componentes/FormOrigen'
import { Panel } from './vistas/Panel'
import { DetalleOrigen } from './vistas/DetalleOrigen'
import { Movimientos } from './vistas/Movimientos'
import { Comparar } from './vistas/Comparar'
import { Ajustes } from './vistas/Ajustes'

type Vista =
  | { tipo: 'panel' }
  | { tipo: 'movimientos' }
  | { tipo: 'comparar' }
  | { tipo: 'ajustes' }
  | { tipo: 'origen'; id: string }

const TITULOS: Record<Vista['tipo'], { titulo: string; sub: string }> = {
  panel: { titulo: 'Panel', sub: 'Como van todos tus negocios juntos' },
  movimientos: { titulo: 'Movimientos', sub: 'Todo lo que ha entrado y salido' },
  comparar: { titulo: 'Comparar origenes', sub: 'A cual conviene meterle mas' },
  ajustes: { titulo: 'Ajustes', sub: 'Respaldo, categorias y preferencias' },
  origen: { titulo: 'Origen', sub: '' },
}

function leerHash(): Vista {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h.startsWith('origen/')) return { tipo: 'origen', id: h.slice(7) }
  if (h === 'movimientos' || h === 'comparar' || h === 'ajustes') return { tipo: h }
  return { tipo: 'panel' }
}

function escribirHash(v: Vista) {
  const destino = v.tipo === 'origen' ? `#/origen/${v.id}` : `#/${v.tipo}`
  if (window.location.hash !== destino) window.location.hash = destino
}

function Aplicacion() {
  const { db, vacio, errorGuardado } = useTienda()
  const [vista, setVista] = useState<Vista>(() => leerHash())
  const [rango, setRango] = useState<Rango>(() => construirRango('mes'))
  const [lateralAbierto, setLateralAbierto] = useState(false)
  const [formMovimiento, setFormMovimiento] = useState<
    { abierto: false } | { abierto: true; origenId?: string; tipo?: TipoMovimiento }
  >({ abierto: false })
  const [formOrigen, setFormOrigen] = useState(false)

  const ir = useCallback((v: Vista) => {
    setVista(v)
    escribirHash(v)
    setLateralAbierto(false)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const alCambiar = () => setVista(leerHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  // Tema
  useEffect(() => {
    const raiz = document.documentElement
    if (db.config.tema === 'auto') raiz.removeAttribute('data-tema')
    else raiz.setAttribute('data-tema', db.config.tema)
  }, [db.config.tema])

  useEffect(() => {
    document.title = `${db.config.nombre} · AdminVUrslef`
  }, [db.config.nombre])

  // Atajo: "n" abre el registro rapido.
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

  const saldos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const o of db.origenes) {
      mapa.set(o.id, calcular(movimientosDe(db.movimientos, o.id), db.categorias, o.id).caja)
    }
    return mapa
  }, [db.origenes, db.movimientos, db.categorias])

  const origenActual =
    vista.tipo === 'origen' ? db.origenes.find((o) => o.id === vista.id) : undefined
  const encabezado =
    vista.tipo === 'origen'
      ? { titulo: origenActual?.nombre ?? 'Origen', sub: 'Estadisticas e historial del origen' }
      : TITULOS[vista.tipo]

  const navegacion: Array<{ id: Vista['tipo']; icono: string; etiqueta: string }> = [
    { id: 'panel', icono: '📊', etiqueta: 'Panel' },
    { id: 'movimientos', icono: '📋', etiqueta: 'Movimientos' },
    { id: 'comparar', icono: '⚖️', etiqueta: 'Comparar' },
    { id: 'ajustes', icono: '⚙️', etiqueta: 'Ajustes' },
  ]

  return (
    <div className="app">
      {lateralAbierto && (
        <div className="velo-lateral" onClick={() => setLateralAbierto(false)} />
      )}

      <aside className={lateralAbierto ? 'lateral abierto' : 'lateral'}>
        <div className="marca">
          <div className="marca-logo">AV</div>
          <div style={{ minWidth: 0 }}>
            <div className="marca-nombre">{db.config.nombre}</div>
            <div className="marca-sub">AdminVUrslef</div>
          </div>
        </div>

        <nav className="nav">
          {navegacion.map((n) => (
            <button
              key={n.id}
              className={`nav-item${vista.tipo === n.id ? ' activo' : ''}`}
              onClick={() => ir({ tipo: n.id } as Vista)}
            >
              <span className="nav-icono">{n.icono}</span>
              {n.etiqueta}
              {n.id === 'movimientos' && (
                <span className="nav-conteo">{db.movimientos.length}</span>
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
                  <i className="punto" style={{ background: o.color }} />
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {o.emoji} {o.nombre}
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
        {errorGuardado && <div className="banda-error">{errorGuardado}</div>}

        <header className="barra">
          <button
            className="btn chico fantasma solo-movil"
            onClick={() => setLateralAbierto(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <div className="barra-titulo">
            <h1 style={{ fontSize: '1.22rem' }}>
              {vista.tipo === 'origen' && origenActual ? `${origenActual.emoji} ` : ''}
              {encabezado.titulo}
            </h1>
            <span className="mini tenue">{encabezado.sub}</span>
          </div>
          <div className="barra-acciones">
            {vista.tipo !== 'ajustes' && <SelectorRango rango={rango} onCambio={setRango} />}
            <button
              className="btn primario"
              onClick={() => setFormMovimiento({ abierto: true })}
              disabled={vacio}
            >
              + Registrar
            </button>
          </div>
        </header>

        <div className="contenido">
          {vista.tipo === 'panel' && (
            <Panel
              rango={rango}
              onAbrirOrigen={(id) => ir({ tipo: 'origen', id })}
              onNuevoOrigen={() => setFormOrigen(true)}
              onNuevoMovimiento={() => setFormMovimiento({ abierto: true })}
              onVerMovimientos={() => ir({ tipo: 'movimientos' })}
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

      <button
        className="flotante"
        onClick={() => setFormMovimiento({ abierto: true })}
        aria-label="Registrar movimiento"
        disabled={vacio}
      >
        +
      </button>

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
