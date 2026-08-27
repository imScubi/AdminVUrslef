let monedaActual = 'MXN'
let localeActual = 'es-MX'

export function configurarFormato(moneda: string, locale: string) {
  monedaActual = moneda
  localeActual = locale
}

const cacheFormato = new Map<string, Intl.NumberFormat>()

function formateador(opciones: Intl.NumberFormatOptions): Intl.NumberFormat {
  const clave = `${localeActual}|${monedaActual}|${JSON.stringify(opciones)}`
  let f = cacheFormato.get(clave)
  if (!f) {
    f = new Intl.NumberFormat(localeActual, opciones)
    cacheFormato.set(clave, f)
  }
  return f
}

/** $1,234.56 */
export function dinero(n: number, decimales = 2): string {
  const valor = Number.isFinite(n) ? n : 0
  return formateador({
    style: 'currency',
    currency: monedaActual,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/** $1,235 — para tarjetas y graficas donde los centavos estorban. */
export function dineroCorto(n: number): string {
  const valor = Number.isFinite(n) ? n : 0
  if (Math.abs(valor) >= 100000) {
    return formateador({
      style: 'currency',
      currency: monedaActual,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(valor)
  }
  return dinero(valor, 0)
}

/** +$120 / -$80, con signo explicito. */
export function dineroConSigno(n: number, decimales = 2): string {
  const signo = n > 0 ? '+' : ''
  return signo + dinero(n, decimales)
}

export function porcentaje(n: number | null, decimales = 1): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(decimales)}%`
}

export function numero(n: number): string {
  return formateador({ maximumFractionDigits: 0 }).format(n)
}

/** Convierte lo que sea que el usuario escriba en un numero utilizable. */
export function aNumero(texto: string): number {
  if (typeof texto === 'number') return texto
  const limpio = String(texto ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '')
  const n = Number.parseFloat(limpio)
  return Number.isFinite(n) ? n : 0
}
