/** Todo el manejo de fechas es local y en texto YYYY-MM-DD, sin zonas horarias. */

export function hoy(): string {
  return aTexto(new Date())
}

export function aTexto(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export function aFecha(texto: string): Date {
  const [y, m, d] = texto.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function mesDe(texto: string): string {
  return texto.slice(0, 7)
}

export function sumarDias(texto: string, dias: number): string {
  const d = aFecha(texto)
  d.setDate(d.getDate() + dias)
  return aTexto(d)
}

export function sumarMeses(texto: string, meses: number): string {
  const d = aFecha(texto)
  d.setMonth(d.getMonth() + meses)
  return aTexto(d)
}

export function inicioDeMes(texto = hoy()): string {
  return `${mesDe(texto)}-01`
}

export function finDeMes(texto = hoy()): string {
  const d = aFecha(texto)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return aTexto(ultimo)
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = aFecha(hasta).getTime() - aFecha(desde).getTime()
  return Math.round(ms / 86400000)
}

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function nombreMes(mes: string, corto = false): string {
  const [y, m] = mes.split('-').map(Number)
  const nombre = NOMBRES_MES[(m ?? 1) - 1] ?? ''
  const capital = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  if (corto) return `${capital.slice(0, 3)} ${String(y).slice(2)}`
  return `${capital} ${y}`
}

export function fechaLegible(texto: string): string {
  const d = aFecha(texto)
  return `${d.getDate()} ${NOMBRES_MES[d.getMonth()]?.slice(0, 3)} ${d.getFullYear()}`
}

/** "hoy", "ayer", "hace 3 dias"... para el historial. */
export function fechaRelativa(texto: string): string {
  const dif = diasEntre(texto, hoy())
  if (dif === 0) return 'Hoy'
  if (dif === 1) return 'Ayer'
  if (dif > 1 && dif < 7) return `Hace ${dif} dias`
  if (dif < 0) return fechaLegible(texto)
  return fechaLegible(texto)
}

/** Lista de meses YYYY-MM entre dos fechas, ambos incluidos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const salida: string[] = []
  let cursor = inicioDeMes(desde)
  const limite = mesDe(hasta)
  let guarda = 0
  while (mesDe(cursor) <= limite && guarda < 600) {
    salida.push(mesDe(cursor))
    cursor = sumarMeses(cursor, 1)
    guarda++
  }
  return salida
}
