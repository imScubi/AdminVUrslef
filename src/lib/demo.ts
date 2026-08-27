import type { BaseDatos, Movimiento } from '../tipos'
import { baseVacia } from './almacen'
import { nuevoId } from './id'
import { hoy, inicioDeMes, sumarDias, sumarMeses } from './fechas'

/**
 * Datos de ejemplo para ver como se comporta la app antes de meter datos
 * reales. Se pueden borrar de un boton en Ajustes.
 */
export function datosDeEjemplo(): BaseDatos {
  const db = baseVacia()
  const catCompra = db.categorias.find((c) => c.nombre === 'Compra de mercancia')!.id
  const catEnvio = db.categorias.find((c) => c.nombre === 'Envios y paqueteria')!.id
  const catPublicidad = db.categorias.find((c) => c.nombre === 'Publicidad')!.id
  const catHerramientas = db.categorias.find((c) => c.nombre === 'Herramientas y software')!.id
  const catPersonal = db.categorias.find((c) => c.nombre === 'Gasto personal')!.id

  const reventa = {
    id: nuevoId(),
    nombre: 'Reventa de tenis',
    tipo: 'reventa' as const,
    color: '#0ea5e9',
    emoji: '👟',
    metaMensual: 6000,
    notas: 'Compro lotes cada quincena. Precio piso: 1.6x el costo.',
    archivado: false,
    creadoEn: new Date().toISOString(),
  }
  const servicios = {
    id: nuevoId(),
    nombre: 'Disenio freelance',
    tipo: 'servicio' as const,
    color: '#8b5cf6',
    emoji: '🎨',
    metaMensual: 9000,
    notas: 'Logos y flyers. Cobro 50% por adelantado.',
    archivado: false,
    creadoEn: new Date().toISOString(),
  }
  db.origenes = [reventa, servicios]

  const movs: Movimiento[] = []
  const push = (m: Omit<Movimiento, 'id' | 'creadoEn'>) =>
    movs.push({ ...m, id: nuevoId(), creadoEn: new Date().toISOString() })

  push({
    tipo: 'aporte',
    origenId: reventa.id,
    fecha: sumarMeses(inicioDeMes(), -4),
    monto: 20000,
    concepto: 'Capital inicial',
  })
  push({
    tipo: 'aporte',
    origenId: servicios.id,
    fecha: sumarMeses(inicioDeMes(), -4),
    monto: 3500,
    concepto: 'Licencia y equipo',
  })

  const modelos = ['Air Max', 'Forum', 'Superstar', 'Dunk Low', 'Campus', 'Chuck 70']
  const trabajos = ['Logo panaderia', 'Flyer evento', 'Menu restaurante', 'Branding taller', 'Portada album']

  for (let mes = 4; mes >= 0; mes--) {
    const base = sumarMeses(inicioDeMes(), -mes)

    // Reventa: compra lote y vende varios pares.
    push({
      tipo: 'gasto',
      origenId: reventa.id,
      fecha: sumarDias(base, 2),
      monto: 7000 + mes * 400,
      concepto: 'Lote de mayoreo',
      categoria: catCompra,
    })
    const ventasDelMes = 5 + ((5 - mes) % 3)
    for (let i = 0; i < ventasDelMes; i++) {
      const costo = 900 + ((i * 137 + mes * 51) % 500)
      const precio = Math.round(costo * (1.5 + ((i + mes) % 4) * 0.12))
      const fecha = sumarDias(base, 3 + i * 4)
      if (fecha > hoy()) continue
      push({
        tipo: 'venta',
        origenId: reventa.id,
        fecha,
        monto: precio,
        costo,
        concepto: `${modelos[(i + mes) % modelos.length]} ${38 + (i % 6)}`,
      })
      if (i % 2 === 0) {
        push({
          tipo: 'gasto',
          origenId: reventa.id,
          fecha,
          monto: 180,
          concepto: 'Guia de envio',
          categoria: catEnvio,
        })
      }
    }
    push({
      tipo: 'gasto',
      origenId: reventa.id,
      fecha: sumarDias(base, 6),
      monto: 450,
      concepto: 'Anuncios Marketplace',
      categoria: catPublicidad,
    })

    // Servicios: dos o tres trabajos al mes, casi puro margen.
    for (let i = 0; i < 3; i++) {
      const fecha = sumarDias(base, 5 + i * 9)
      if (fecha > hoy()) continue
      push({
        tipo: 'venta',
        origenId: servicios.id,
        fecha,
        monto: 2800 + ((i * 700 + mes * 300) % 3200),
        costo: 0,
        concepto: trabajos[(i + mes) % trabajos.length],
      })
    }
    push({
      tipo: 'gasto',
      origenId: servicios.id,
      fecha: sumarDias(base, 1),
      monto: 640,
      concepto: 'Suscripcion de disenio',
      categoria: catHerramientas,
    })

    // Retiros para gasto personal.
    if (sumarDias(base, 20) <= hoy()) {
      push({
        tipo: 'retiro',
        origenId: servicios.id,
        fecha: sumarDias(base, 20),
        monto: 4000,
        concepto: 'Gastos del mes',
        categoria: catPersonal,
      })
    }
    if (mes % 2 === 0 && sumarDias(base, 24) <= hoy()) {
      push({
        tipo: 'retiro',
        origenId: reventa.id,
        fecha: sumarDias(base, 24),
        monto: 2500,
        concepto: 'Gastos del mes',
        categoria: catPersonal,
      })
    }
  }

  // Un traspaso: la ganancia del freelance financia mas mercancia.
  push({
    tipo: 'traspaso',
    origenId: servicios.id,
    destinoId: reventa.id,
    fecha: sumarDias(inicioDeMes(sumarMeses(hoy(), -1)), 12),
    monto: 5000,
    concepto: 'Refuerzo para comprar lote',
  })

  db.movimientos = movs.filter((m) => m.fecha <= hoy())
  return db
}
