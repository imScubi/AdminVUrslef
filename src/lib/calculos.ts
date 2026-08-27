import type { BaseDatos, Categoria, Movimiento, Origen } from '../tipos'
import { diasEntre, hoy, inicioDeMes, mesDe, mesesEntre, sumarMeses } from './fechas'

export interface Rango {
  id: string
  etiqueta: string
  desde: string
  hasta: string
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

export function enRango(m: Movimiento, rango: Rango): boolean {
  return m.fecha >= rango.desde && m.fecha <= rango.hasta
}

export function filtrarRango(movs: Movimiento[], rango: Rango): Movimiento[] {
  return movs.filter((m) => enRango(m, rango))
}

/** Movimientos que tocan un origen, incluyendo traspasos que le llegan. */
export function movimientosDe(movs: Movimiento[], origenId: string): Movimiento[] {
  return movs.filter((m) => m.origenId === origenId || m.destinoId === origenId)
}

function esInventario(m: Movimiento, categorias: Categoria[]): boolean {
  if (m.tipo !== 'gasto') return false
  const cat = categorias.find((c) => c.id === m.categoria)
  return Boolean(cat?.inventario)
}

/* ------------------------------------------------------------------ */
/* Estadisticas                                                        */
/* ------------------------------------------------------------------ */

export interface Estadisticas {
  /** Dinero que entro por ventas. */
  ventas: number
  numVentas: number
  /** Cuanto te costo a ti la mercancia/insumo de esas ventas. */
  costoVendido: number
  /** ventas - costoVendido. Lo que deja el producto antes de gastos. */
  gananciaBruta: number
  /** Gastos de operar que NO son compra de mercancia. */
  gastosOperativos: number
  /** Dinero puesto en mercancia/insumos (no es perdida: se vuelve inventario). */
  comprasInventario: number
  /** De esas compras, cuanto corresponde a las que declararon retorno esperado. */
  comprasConEstimacion: number
  /** Suma de lo que esperas recibir al vender esas compras. */
  retornoEsperado: number
  gastosTotales: number
  /** gananciaBruta - gastosOperativos. La ganancia de verdad. */
  gananciaNeta: number
  aportes: number
  retiros: number
  entradas: number
  salidas: number
  ajustes: number
  /** Dinero disponible en la caja del origen. */
  caja: number
  /** Valor a costo de la mercancia que aun no vendes. */
  inventario: number
  /** caja + inventario: todo lo que vale el origen ahora mismo. */
  patrimonio: number
  margen: number | null
  margenNeto: number | null
  /** Cuantas veces esperas multiplicar cada peso puesto en mercancia. */
  factorEsperado: number | null
  /** Margen que esperabas sacarle a la mercancia, para contrastar con el real. */
  margenEsperado: number | null
  /** Lo que esperas recibir por la mercancia que todavia no vendes. */
  valorEsperadoInventario: number | null
  /** Ganancia que sigue guardada en esa mercancia. */
  gananciaEsperadaPendiente: number | null
  ticketPromedio: number | null
  /** Ganancia por cada peso que metiste en costos y gastos. */
  rendimientoPorPeso: number | null
  /** gananciaNeta / aportes de capital (%). */
  roi: number | null
  /** Cuanto de tu capital aportado ya te regresaste (%). */
  recuperado: number | null
  ultimaVenta: string | null
  diasSinVender: number | null
}

const CERO: Estadisticas = {
  ventas: 0, numVentas: 0, costoVendido: 0, gananciaBruta: 0,
  gastosOperativos: 0, comprasInventario: 0, comprasConEstimacion: 0, retornoEsperado: 0,
  gastosTotales: 0, gananciaNeta: 0,
  aportes: 0, retiros: 0, entradas: 0, salidas: 0, ajustes: 0,
  caja: 0, inventario: 0, patrimonio: 0,
  margen: null, margenNeto: null, factorEsperado: null, margenEsperado: null,
  valorEsperadoInventario: null, gananciaEsperadaPendiente: null,
  ticketPromedio: null, rendimientoPorPeso: null,
  roi: null, recuperado: null, ultimaVenta: null, diasSinVender: null,
}

/**
 * Motor de numeros. Recibe una lista ya filtrada de movimientos.
 *
 * `origenId` indica desde el punto de vista de que origen se leen los
 * traspasos. Si se omite, se calcula el consolidado (los traspasos entre
 * origenes se ignoran porque el dinero no sale del conjunto).
 */
export function calcular(
  movs: Movimiento[],
  categorias: Categoria[],
  origenId?: string,
): Estadisticas {
  const e: Estadisticas = { ...CERO }

  for (const m of movs) {
    switch (m.tipo) {
      case 'venta': {
        e.ventas += m.monto
        e.numVentas += 1
        e.costoVendido += m.costo ?? 0
        if (!e.ultimaVenta || m.fecha > e.ultimaVenta) e.ultimaVenta = m.fecha
        break
      }
      case 'gasto': {
        if (esInventario(m, categorias)) {
          e.comprasInventario += m.monto
          if (m.retornoEsperado != null && m.retornoEsperado > 0) {
            e.comprasConEstimacion += m.monto
            e.retornoEsperado += m.retornoEsperado
          }
        } else {
          e.gastosOperativos += m.monto
        }
        break
      }
      case 'aporte':
        e.aportes += m.monto
        break
      case 'retiro':
        e.retiros += m.monto
        break
      case 'traspaso': {
        if (!origenId) break // consolidado: se cancela solo
        if (m.destinoId === origenId) e.entradas += m.monto
        else if (m.origenId === origenId) e.salidas += m.monto
        break
      }
      case 'ajuste':
        e.ajustes += m.monto
        break
    }
  }

  e.gastosTotales = e.gastosOperativos + e.comprasInventario
  e.gananciaBruta = e.ventas - e.costoVendido
  e.gananciaNeta = e.gananciaBruta - e.gastosOperativos
  e.caja =
    e.ventas + e.aportes + e.entradas + e.ajustes - e.gastosTotales - e.retiros - e.salidas
  e.inventario = e.comprasInventario - e.costoVendido
  e.patrimonio = e.caja + Math.max(e.inventario, 0)

  /*
   * Lo esperado se proyecta con un factor, no con una resta: si compraste
   * $7,000 esperando $12,000, cada peso de mercancia vale 1.71 al venderse.
   * Ese factor se aplica a lo que queda sin vender, asi el pronostico baja
   * solo conforme vas vendiendo, sin tener que llevar cuenta pieza por pieza.
   */
  e.factorEsperado =
    e.comprasConEstimacion > 0 ? e.retornoEsperado / e.comprasConEstimacion : null
  e.margenEsperado =
    e.retornoEsperado > 0
      ? ((e.retornoEsperado - e.comprasConEstimacion) / e.retornoEsperado) * 100
      : null
  if (e.factorEsperado !== null && e.inventario > 0) {
    e.valorEsperadoInventario = e.inventario * e.factorEsperado
    e.gananciaEsperadaPendiente = e.valorEsperadoInventario - e.inventario
  }

  e.margen = e.ventas > 0 ? (e.gananciaBruta / e.ventas) * 100 : null
  e.margenNeto = e.ventas > 0 ? (e.gananciaNeta / e.ventas) * 100 : null
  e.ticketPromedio = e.numVentas > 0 ? e.ventas / e.numVentas : null

  const invertidoEnOperar = e.costoVendido + e.gastosOperativos
  e.rendimientoPorPeso = invertidoEnOperar > 0 ? e.gananciaNeta / invertidoEnOperar : null
  e.roi = e.aportes > 0 ? (e.gananciaNeta / e.aportes) * 100 : null
  e.recuperado = e.aportes > 0 ? (e.retiros / e.aportes) * 100 : null
  e.diasSinVender = e.ultimaVenta ? diasEntre(e.ultimaVenta, hoy()) : null

  return e
}

/** Estadisticas de un origen: acumulado historico + solo el periodo elegido. */
export interface FichaOrigen {
  origen: Origen
  total: Estadisticas
  periodo: Estadisticas
}

export function fichaDeOrigen(
  db: BaseDatos,
  origen: Origen,
  rango: Rango,
): FichaOrigen {
  const propios = movimientosDe(db.movimientos, origen.id)
  return {
    origen,
    total: calcular(propios, db.categorias, origen.id),
    periodo: calcular(filtrarRango(propios, rango), db.categorias, origen.id),
  }
}

export function fichasDeOrigenes(db: BaseDatos, rango: Rango): FichaOrigen[] {
  return db.origenes.map((o) => fichaDeOrigen(db, o, rango))
}

export function consolidado(db: BaseDatos, rango: Rango) {
  const activos = new Set(db.origenes.map((o) => o.id))
  const vigentes = db.movimientos.filter((m) => activos.has(m.origenId))
  return {
    total: calcular(vigentes, db.categorias),
    periodo: calcular(filtrarRango(vigentes, rango), db.categorias),
  }
}

/* ------------------------------------------------------------------ */
/* Series para graficas                                                */
/* ------------------------------------------------------------------ */

export interface PuntoMes {
  mes: string
  ventas: number
  gastos: number
  gananciaNeta: number
  retiros: number
}

export function serieMensual(
  movs: Movimiento[],
  categorias: Categoria[],
  meses: number,
  origenId?: string,
): PuntoMes[] {
  const finalMes = mesDe(hoy())
  const inicio = mesDe(sumarMeses(inicioDeMes(), -(meses - 1)))
  const lista = mesesEntre(`${inicio}-01`, `${finalMes}-01`)
  const mapa = new Map<string, Movimiento[]>(lista.map((m) => [m, []]))

  for (const m of movs) {
    const clave = mesDe(m.fecha)
    const cubeta = mapa.get(clave)
    if (cubeta) cubeta.push(m)
  }

  return lista.map((mes) => {
    const e = calcular(mapa.get(mes) ?? [], categorias, origenId)
    return {
      mes,
      ventas: e.ventas,
      gastos: e.gastosTotales,
      gananciaNeta: e.gananciaNeta,
      retiros: e.retiros,
    }
  })
}

export interface RebanadaCategoria {
  id: string
  nombre: string
  monto: number
  porcentaje: number
  inventario: boolean
}

export function gastosPorCategoria(
  movs: Movimiento[],
  categorias: Categoria[],
  tipo: 'gasto' | 'retiro' = 'gasto',
): RebanadaCategoria[] {
  const acumulado = new Map<string, number>()
  let total = 0
  for (const m of movs) {
    if (m.tipo !== tipo) continue
    const clave = m.categoria ?? 'sin-categoria'
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + m.monto)
    total += m.monto
  }
  return [...acumulado.entries()]
    .map(([id, monto]) => {
      const cat = categorias.find((c) => c.id === id)
      return {
        id,
        nombre: cat?.nombre ?? 'Sin categoria',
        monto,
        porcentaje: total > 0 ? (monto / total) * 100 : 0,
        inventario: Boolean(cat?.inventario),
      }
    })
    .sort((a, b) => b.monto - a.monto)
}

/* ------------------------------------------------------------------ */
/* Comparador de origenes                                              */
/* ------------------------------------------------------------------ */

export interface FilaComparativa {
  ficha: FichaOrigen
  /** Ganancia neta promedio por mes dentro del periodo. */
  gananciaMensual: number
  /** Cambio % de ganancia neta contra la mitad anterior del periodo. */
  tendencia: number | null
  /** Dias que tarda en venderse la mercancia parada. */
  diasInventario: number | null
  puntaje: number
}

function normalizar01(valor: number, minimo: number, maximo: number): number {
  if (maximo === minimo) return 0.5
  return Math.min(1, Math.max(0, (valor - minimo) / (maximo - minimo)))
}

export function compararOrigenes(db: BaseDatos, rango: Rango): FilaComparativa[] {
  const dias = Math.max(1, diasEntre(rango.desde, rango.hasta) + 1)
  const meses = Math.max(1, dias / 30.4)
  const mitad = new Date(
    (new Date(rango.desde).getTime() + new Date(rango.hasta).getTime()) / 2,
  )
    .toISOString()
    .slice(0, 10)

  const base = db.origenes
    .filter((o) => !o.archivado)
    .map((origen): Omit<FilaComparativa, 'puntaje'> => {
      const ficha = fichaDeOrigen(db, origen, rango)
      const propios = movimientosDe(db.movimientos, origen.id)
      const primeraMitad = calcular(
        propios.filter((m) => m.fecha >= rango.desde && m.fecha < mitad),
        db.categorias,
        origen.id,
      )
      const segundaMitad = calcular(
        propios.filter((m) => m.fecha >= mitad && m.fecha <= rango.hasta),
        db.categorias,
        origen.id,
      )
      const previa = primeraMitad.gananciaNeta
      const tendencia =
        Math.abs(previa) > 0.01
          ? ((segundaMitad.gananciaNeta - previa) / Math.abs(previa)) * 100
          : segundaMitad.gananciaNeta > 0
            ? 100
            : null

      const costoDiario = ficha.periodo.costoVendido / dias
      const diasInventario =
        costoDiario > 0 && ficha.total.inventario > 0
          ? ficha.total.inventario / costoDiario
          : null

      return {
        ficha,
        gananciaMensual: ficha.periodo.gananciaNeta / meses,
        tendencia,
        diasInventario,
      }
    })

  if (!base.length) return []

  // Las tres primeras medidas se anclan a valores absolutos para que el
  // puntaje signifique algo por si solo; solo "cuanto deja al mes" se compara
  // contra el mejor del grupo, porque ahi si importa el tamanio relativo.
  const mejorGanancia = Math.max(...base.map((f) => f.gananciaMensual), 0.01)

  return base
    .map((f) => {
      const margen = normalizar01(f.ficha.periodo.margen ?? 0, 0, 60)
      const rendimiento = normalizar01(f.ficha.periodo.rendimientoPorPeso ?? 0, 0, 1)
      const escala = normalizar01(f.gananciaMensual, 0, mejorGanancia)
      const tendencia = normalizar01(f.tendencia ?? 0, -50, 100)
      return {
        ...f,
        // Mezcla explicita: cuanto deja, que tan rentable es por venta,
        // cuanto rinde cada peso metido y para donde va la tendencia.
        puntaje: Math.round(
          (escala * 0.35 + margen * 0.25 + rendimiento * 0.25 + tendencia * 0.15) * 100,
        ),
      }
    })
    .sort((a, b) => b.puntaje - a.puntaje)
}

/* ------------------------------------------------------------------ */
/* Alertas de salud financiera                                         */
/* ------------------------------------------------------------------ */

export interface Alerta {
  id: string
  nivel: 'peligro' | 'aviso' | 'bien'
  titulo: string
  detalle: string
  origenId?: string
}

export function generarAlertas(db: BaseDatos): Alerta[] {
  const alertas: Alerta[] = []
  const mesActual: Rango = {
    id: 'mes',
    etiqueta: 'Este mes',
    desde: inicioDeMes(),
    hasta: hoy(),
  }
  const activos = db.origenes.filter((o) => !o.archivado)

  for (const origen of activos) {
    const { total, periodo } = fichaDeOrigen(db, origen, mesActual)

    if (total.caja < -0.01) {
      alertas.push({
        id: `caja-${origen.id}`,
        nivel: 'peligro',
        titulo: `${origen.nombre} tiene la caja en negativo`,
        detalle:
          'Saliste con mas dinero del que entro. Registra un aporte si le metiste dinero de otro lado, o revisa si falta capturar ventas.',
        origenId: origen.id,
      })
    }

    if (
      periodo.ventas > 0 &&
      periodo.margen !== null &&
      periodo.margen < db.config.margenObjetivo
    ) {
      alertas.push({
        id: `margen-${origen.id}`,
        nivel: 'aviso',
        titulo: `Margen bajo en ${origen.nombre}`,
        detalle: `Este mes vas en ${periodo.margen.toFixed(1)}% de margen, debajo de tu objetivo de ${db.config.margenObjetivo}%. O subes precio o bajas costo.`,
        origenId: origen.id,
      })
    }

    if (
      total.diasSinVender !== null &&
      total.diasSinVender > db.config.diasSinVentasAlerta
    ) {
      alertas.push({
        id: `dormido-${origen.id}`,
        nivel: 'aviso',
        titulo: `${origen.nombre} lleva ${total.diasSinVender} dias sin vender`,
        detalle: 'Si tienes dinero parado aqui, tal vez rinde mas en otro origen.',
        origenId: origen.id,
      })
    }

    if (total.inventario > 0 && total.patrimonio > 0) {
      const proporcion = (total.inventario / total.patrimonio) * 100
      if (proporcion > 65) {
        alertas.push({
          id: `inventario-${origen.id}`,
          nivel: 'aviso',
          titulo: `Tu dinero de ${origen.nombre} esta en mercancia`,
          detalle: `El ${proporcion.toFixed(0)}% del valor de este origen es inventario sin vender. Por eso se siente que no hay dinero aunque el negocio si este ganando.`,
          origenId: origen.id,
        })
      }
    }

    if (
      total.margenEsperado !== null &&
      total.margen !== null &&
      total.numVentas >= 3 &&
      total.margen < total.margenEsperado - 10
    ) {
      alertas.push({
        id: `esperado-${origen.id}`,
        nivel: 'aviso',
        titulo: `Estas vendiendo mas barato de lo que planeaste en ${origen.nombre}`,
        detalle: `Al comprar la mercancia esperabas ${total.margenEsperado.toFixed(0)}% de margen y vas en ${total.margen.toFixed(0)}%. Revisa si estas rematando o si el costo subio.`,
        origenId: origen.id,
      })
    }

    if (periodo.retiros > 0 && periodo.retiros > periodo.gananciaNeta) {
      alertas.push({
        id: `retiros-${origen.id}`,
        nivel: 'peligro',
        titulo: `Estas sacando mas de lo que gana ${origen.nombre}`,
        detalle: `Este mes retiraste mas que la ganancia neta del origen. Cada retiro de mas se come el capital de trabajo.`,
        origenId: origen.id,
      })
    }
  }

  // Concentracion de ingresos: depender de un solo origen es riesgo.
  const fichas = activos.map((o) => fichaDeOrigen(db, o, mesActual))
  const gananciaTotal = fichas.reduce((s, f) => s + Math.max(f.periodo.gananciaNeta, 0), 0)
  if (fichas.length > 1 && gananciaTotal > 0) {
    const lider = [...fichas].sort((a, b) => b.periodo.gananciaNeta - a.periodo.gananciaNeta)[0]
    const cuota = (Math.max(lider.periodo.gananciaNeta, 0) / gananciaTotal) * 100
    if (cuota > 75) {
      alertas.push({
        id: 'concentracion',
        nivel: 'aviso',
        titulo: `${cuota.toFixed(0)}% de tu ganancia viene de ${lider.origen.nombre}`,
        detalle: 'Si ese origen se cae, se te cae casi todo. Vale la pena empujar un segundo.',
        origenId: lider.origen.id,
      })
    }
  }

  const orden = { peligro: 0, aviso: 1, bien: 2 }
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}
