import type { Articulo, BaseDatos, Categoria, Movimiento, Origen, Pedido } from '../tipos'
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
  // Un pedido pagado en abonos es UNA venta, no una por abono; si no, el
  // ticket promedio se hunde y el numero de ventas se infla.
  const pedidosContados = new Set<string>()

  for (const m of movs) {
    switch (m.tipo) {
      case 'venta': {
        e.ventas += m.monto
        if (!m.pedidoId) e.numVentas += 1
        else if (!pedidosContados.has(m.pedidoId)) {
          pedidosContados.add(m.pedidoId)
          e.numVentas += 1
        }
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


/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export interface EstadoCuenta {
  pedido: Pedido
  /** Abonos de este pedido, del mas viejo al mas nuevo. */
  abonos: Movimiento[]
  abonado: number
  saldo: number
  /** Porcentaje ya cubierto, topado a 100. */
  avance: number
  liquidado: boolean
}

export function abonosDe(movs: Movimiento[], pedidoId: string): Movimiento[] {
  return movs
    .filter((m) => m.pedidoId === pedidoId && m.tipo === 'venta')
    .sort((a, b) =>
      a.fecha === b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha),
    )
}

export function estadoDeCuenta(pedido: Pedido, movs: Movimiento[]): EstadoCuenta {
  const abonos = abonosDe(movs, pedido.id)
  const abonado = abonos.reduce((s, m) => s + m.monto, 0)
  const saldo = pedido.total - abonado
  return {
    pedido,
    abonos,
    abonado,
    saldo,
    avance: pedido.total > 0 ? Math.min(100, (abonado / pedido.total) * 100) : 0,
    liquidado: saldo <= 0.005,
  }
}

export interface ResumenPedidos {
  abiertos: number
  /** Dinero que te deben en los pedidos abiertos. */
  porCobrar: number
  /** Cuanto llevan abonado esos pedidos abiertos. */
  abonado: number
  /** Pedidos abiertos sin un solo abono. */
  sinAbonar: number
}

export function resumenPedidos(db: BaseDatos, origenId?: string): ResumenPedidos {
  const resumen: ResumenPedidos = { abiertos: 0, porCobrar: 0, abonado: 0, sinAbonar: 0 }
  for (const pedido of db.pedidos) {
    if (pedido.estado !== 'abierto') continue
    if (origenId && pedido.origenId !== origenId) continue
    const cuenta = estadoDeCuenta(pedido, db.movimientos)
    resumen.abiertos += 1
    resumen.porCobrar += Math.max(cuenta.saldo, 0)
    resumen.abonado += cuenta.abonado
    if (cuenta.abonado <= 0) resumen.sinAbonar += 1
  }
  return resumen
}

/** Siguiente folio de recibo dentro de un origen. */
export function siguienteFolio(db: BaseDatos, origenId: string): number {
  let mayor = 0
  const suyos = new Set(db.pedidos.filter((p) => p.origenId === origenId).map((p) => p.id))
  for (const m of db.movimientos) {
    if (!m.folio) continue
    if (m.origenId !== origenId && !(m.pedidoId && suyos.has(m.pedidoId))) continue
    if (m.folio > mayor) mayor = m.folio
  }
  return mayor + 1
}


/* ------------------------------------------------------------------ */
/* Inventario por producto                                             */
/* ------------------------------------------------------------------ */

export interface Existencia {
  articulo: Articulo
  origenId: string
  /** Movimiento de compra del que salio. */
  compraId: string
  fechaCompra: string
  comprados: number
  vendidos: number
  disponibles: number
  /** Lo que vale a costo lo que aun te queda. */
  valorDisponible: number
  /** Lo que esperas recibir si vendes lo que queda al precio previsto. */
  valorEsperado: number | null
}

/**
 * Junta el desglose de todas las compras de mercancia y le resta lo que ya
 * salio en pedidos. Los pedidos cancelados no descuentan: esa mercancia
 * regresa al estante.
 */
export function inventarioDe(db: BaseDatos, origenId?: string): Existencia[] {
  const vendidoPorArticulo = new Map<string, number>()
  for (const pedido of db.pedidos) {
    if (pedido.estado === 'cancelado') continue
    for (const linea of pedido.lineas ?? []) {
      if (!linea.articuloId) continue
      vendidoPorArticulo.set(
        linea.articuloId,
        (vendidoPorArticulo.get(linea.articuloId) ?? 0) + linea.cantidad,
      )
    }
  }

  const salida: Existencia[] = []
  for (const compra of db.movimientos) {
    if (compra.tipo !== 'gasto' || !compra.articulos?.length) continue
    if (origenId && compra.origenId !== origenId) continue
    for (const articulo of compra.articulos) {
      const vendidos = vendidoPorArticulo.get(articulo.id) ?? 0
      const disponibles = Math.max(0, articulo.cantidad - vendidos)
      salida.push({
        articulo,
        origenId: compra.origenId,
        compraId: compra.id,
        fechaCompra: compra.fecha,
        comprados: articulo.cantidad,
        vendidos,
        disponibles,
        valorDisponible: disponibles * articulo.costoUnitario,
        valorEsperado: articulo.precio ? disponibles * articulo.precio : null,
      })
    }
  }
  return salida.sort((a, b) =>
    a.fechaCompra === b.fechaCompra
      ? a.articulo.nombre.localeCompare(b.articulo.nombre)
      : b.fechaCompra.localeCompare(a.fechaCompra),
  )
}

/** Lo que a ti te costo la mercancia que se lleva un pedido. */
export function costoDePedido(pedido: Pedido): number {
  return (pedido.lineas ?? []).reduce((s, l) => s + l.cantidad * l.costoUnitario, 0)
}

/** Suma de los renglones, para proponer el total del pedido. */
export function totalDeLineas(pedido: Pick<Pedido, 'lineas'>): number {
  return (pedido.lineas ?? []).reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
}

/**
 * Cuanto costo repartir a un abono. El costo se reconoce en proporcion a lo
 * cobrado: si llevas la mitad del pedido pagado, se reconoce la mitad del
 * costo. Asi el margen del mes no se dispara ni se hunde por el momento en
 * que el cliente termino de pagar.
 */
export function costoDeAbono(pedido: Pedido, montoAbono: number): number | undefined {
  const costo = costoDePedido(pedido)
  if (costo <= 0 || pedido.total <= 0) return undefined
  return Math.round(costo * (montoAbono / pedido.total) * 100) / 100
}
