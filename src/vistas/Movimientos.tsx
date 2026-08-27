import { useMemo, useState } from 'react'
import { useTienda } from '../estado/tienda'
import { calcular, filtrarRango, type Rango } from '../lib/calculos'
import { dinero } from '../lib/formato'
import { ETIQUETA_MOVIMIENTO, type TipoMovimiento } from '../tipos'
import { ListaMovimientos } from '../componentes/ListaMovimientos'
import { Metrica } from '../componentes/ui'

export function Movimientos({
  rango,
  onNuevoMovimiento,
}: {
  rango: Rango
  onNuevoMovimiento: () => void
}) {
  const { db } = useTienda()
  const [texto, setTexto] = useState('')
  const [origenId, setOrigenId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('')
  const [categoria, setCategoria] = useState('')
  const [todoElTiempo, setTodoElTiempo] = useState(false)

  const filtrados = useMemo(() => {
    const base = todoElTiempo ? db.movimientos : filtrarRango(db.movimientos, rango)
    const busqueda = texto.trim().toLowerCase()
    return base.filter((m) => {
      if (origenId && m.origenId !== origenId && m.destinoId !== origenId) return false
      if (tipo && m.tipo !== tipo) return false
      if (categoria && m.categoria !== categoria) return false
      if (busqueda) {
        const heno = `${m.concepto} ${m.nota ?? ''}`.toLowerCase()
        if (!heno.includes(busqueda)) return false
      }
      return true
    })
  }, [db.movimientos, rango, todoElTiempo, texto, origenId, tipo, categoria])

  const resumen = useMemo(
    () => calcular(filtrados, db.categorias, origenId || undefined),
    [filtrados, db.categorias, origenId],
  )

  function exportarCsv() {
    const cabeceras = [
      'fecha', 'tipo', 'origen', 'destino', 'concepto', 'categoria', 'monto', 'costo', 'nota',
    ]
    const filas = [...filtrados]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((m) => [
        m.fecha,
        ETIQUETA_MOVIMIENTO[m.tipo],
        db.origenes.find((o) => o.id === m.origenId)?.nombre ?? '',
        db.origenes.find((o) => o.id === m.destinoId)?.nombre ?? '',
        m.concepto,
        db.categorias.find((c) => c.id === m.categoria)?.nombre ?? '',
        String(m.monto),
        m.costo != null ? String(m.costo) : '',
        m.nota ?? '',
      ])
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [cabeceras, ...filas].map((f) => f.map(escapar).join(',')).join('\r\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const categoriasUsables = db.categorias.filter((c) =>
    tipo === 'retiro' ? c.ambito === 'retiro' : tipo === 'gasto' ? c.ambito === 'gasto' : true,
  )

  return (
    <>
      <div className="rejilla c4">
        <Metrica mediana etiqueta="Entradas por venta" valor={dinero(resumen.ventas)} tono="pos" pie={`${resumen.numVentas} ventas`} />
        <Metrica mediana etiqueta="Salidas" valor={dinero(resumen.gastosTotales)} tono="neg" pie={`Incluye ${dinero(resumen.comprasInventario, 0)} de mercancia`} />
        <Metrica mediana etiqueta="Retiros" valor={dinero(resumen.retiros)} />
        <Metrica
          mediana
          etiqueta="Ganancia neta"
          valor={dinero(resumen.gananciaNeta)}
          tono={resumen.gananciaNeta >= 0 ? 'pos' : 'neg'}
        />
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab" style={{ gap: 10 }}>
          <h2>Buscar</h2>
          <div className="barra-acciones">
            <button className="btn chico" onClick={exportarCsv} disabled={!filtrados.length}>
              Exportar CSV
            </button>
            <button className="btn chico primario" onClick={onNuevoMovimiento}>
              + Registrar
            </button>
          </div>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="fila">
            <div className="campo" style={{ flex: '2 1 220px' }}>
              <label htmlFor="f-texto">Concepto o nota</label>
              <input
                id="f-texto"
                type="search"
                placeholder="Buscar…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="f-origen">Origen</label>
              <select id="f-origen" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
                <option value="">Todos</option>
                {db.origenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.emoji} {o.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-tipo">Tipo</label>
              <select
                id="f-tipo"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoMovimiento | '')
                  setCategoria('')
                }}
              >
                <option value="">Todos</option>
                {Object.entries(ETIQUETA_MOVIMIENTO).map(([id, etiqueta]) => (
                  <option key={id} value={id}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-cat">Categoria</label>
              <select id="f-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {categoriasUsables.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: '0.85rem' }}
          >
            <input
              type="checkbox"
              checked={todoElTiempo}
              onChange={(e) => setTodoElTiempo(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Ver todo el historial (ignorar el periodo de arriba)
          </label>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>{filtrados.length} movimientos</h2>
          <span className="mini tenue">{todoElTiempo ? 'Todo el historial' : rango.etiqueta}</span>
        </div>
        <ListaMovimientos
          movimientos={filtrados}
          origenId={origenId || undefined}
          vacioTexto="Ningun movimiento coincide con los filtros."
        />
      </div>
    </>
  )
}
