import { useCallback, useEffect, useRef, useState } from 'react'
import type { Movimiento, Origen, Pedido } from '../tipos'
import { ETIQUETA_METODO, ETIQUETA_TIPO_PEDIDO } from '../tipos'
import { estadoDeCuenta } from '../lib/calculos'
import { dinero } from '../lib/formato'
import { fechaLegible } from '../lib/fechas'
import { Modal } from './ui'

const ANCHO = 840
const MARGEN = 48
const ESCALA = 2

interface Props {
  pedido: Pedido
  origen: Origen
  movimientos: Movimiento[]
  /** Abono del que se hace el recibo. Sin el, sale el estado de cuenta. */
  abono?: Movimiento
  onCerrar: () => void
}

/** Parte un texto en lineas que quepan en `ancho`. */
function repartir(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const lineas: string[] = []
  for (const parrafo of texto.split('\n')) {
    let actual = ''
    for (const palabra of parrafo.split(/\s+/)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (ctx.measureText(prueba).width > ancho && actual) {
        lineas.push(actual)
        actual = palabra
      } else {
        actual = prueba
      }
    }
    lineas.push(actual)
  }
  return lineas
}

function rectRedondo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

/**
 * Dibuja el recibo en un canvas y devuelve su alto.
 *
 * Se dibuja a mano en vez de convertir HTML a imagen: asi el recibo se ve
 * igual en cualquier telefono, no depende del tema claro/oscuro de la app y
 * no hace falta ninguna libreria.
 */
export async function dibujarRecibo(
  canvas: HTMLCanvasElement,
  { pedido, origen, movimientos, abono }: Omit<Props, 'onCerrar'>,
): Promise<void> {
  const cuenta = estadoDeCuenta(pedido, movimientos)
  const logo = origen.logo ? await cargarImagen(origen.logo) : null

  /*
   * Se dibuja en un lienzo de sobra y al final se recorta a la altura que de
   * verdad ocupo. Calcular el alto por adelantado obligaba a mantener dos
   * cuentas en paralelo y se desfasaban: el pie terminaba encimado con la
   * leyenda del negocio.
   */
  const ALTO_SOBRADO = 3000
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO * ESCALA
  lienzo.height = ALTO_SOBRADO * ESCALA
  const ctx = lienzo.getContext('2d')!
  ctx.scale(ESCALA, ESCALA)

  const anchoUtil = ANCHO - MARGEN * 2
  ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
  const lineasConcepto = pedido.concepto.trim()
    ? repartir(ctx, pedido.concepto.trim(), anchoUtil)
    : []

  const abonosPrevios = abono
    ? cuenta.abonos.filter(
        (a) => a.fecha < abono.fecha || (a.fecha === abono.fecha && a.creadoEn < abono.creadoEn),
      )
    : cuenta.abonos

  const tinta = '#14171e'
  const suave = '#6b7280'
  const linea = '#e5e7eb'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO, ALTO_SOBRADO)
  ctx.fillStyle = origen.color
  ctx.fillRect(0, 0, ANCHO, 10)

  let y = 62

  // --- Encabezado ---
  const hayLogo = Boolean(logo)
  if (logo) {
    ctx.save()
    rectRedondo(ctx, MARGEN, y, 96, 96, 20)
    ctx.clip()
    const escala = Math.max(96 / logo.width, 96 / logo.height)
    const w = logo.width * escala
    const h = logo.height * escala
    ctx.drawImage(logo, MARGEN + (96 - w) / 2, y + (96 - h) / 2, w, h)
    ctx.restore()
  }

  const xTexto = hayLogo ? MARGEN + 122 : MARGEN
  ctx.textAlign = 'left'
  ctx.fillStyle = tinta
  ctx.font = '700 38px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(origen.nombre, xTexto, y + 36)
  if (origen.contacto?.trim()) {
    ctx.fillStyle = suave
    ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(origen.contacto.trim(), xTexto, y + 70)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = suave
  ctx.font = '600 20px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(abono ? 'RECIBO DE ABONO' : 'ESTADO DE CUENTA', ANCHO - MARGEN, y + 22)
  ctx.fillStyle = tinta
  ctx.font = '700 26px system-ui, -apple-system, "Segoe UI", sans-serif'
  const folio = abono?.folio ? `Folio ${String(abono.folio).padStart(4, '0')}` : ''
  if (folio) ctx.fillText(folio, ANCHO - MARGEN, y + 54)
  ctx.fillStyle = suave
  ctx.font = '400 20px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(fechaLegible(abono?.fecha ?? pedido.fecha), ANCHO - MARGEN, y + 84)

  y += hayLogo ? 128 : 118
  ctx.strokeStyle = linea
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGEN, y)
  ctx.lineTo(ANCHO - MARGEN, y)
  ctx.stroke()
  y += 42

  const etiqueta = (texto: string) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = suave
    ctx.font = '600 17px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(texto.toUpperCase(), MARGEN, y)
    y += 28
  }
  const valor = (texto: string, grande = false) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = tinta
    ctx.font = `${grande ? '700 30px' : '500 24px'} system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.fillText(texto, MARGEN, y)
    y += grande ? 42 : 34
  }

  // --- Cliente ---
  etiqueta('Cliente')
  valor(pedido.cliente.trim() || 'Mostrador', true)
  if (pedido.telefono.trim()) {
    ctx.fillStyle = suave
    ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(pedido.telefono.trim(), MARGEN, y - 8)
    y += 26
  }
  y += 12

  // --- Concepto ---
  if (lineasConcepto.length) {
    etiqueta(ETIQUETA_TIPO_PEDIDO[pedido.tipo])
    ctx.fillStyle = tinta
    ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
    for (const l of lineasConcepto) {
      ctx.fillText(l, MARGEN, y)
      y += 30
    }
    y += 14
  }

  // --- Cuadro de importes ---
  const abonadoAntes = abonosPrevios.reduce((s, a) => s + a.monto, 0)
  const abonadoTotal = abono ? abonadoAntes + abono.monto : cuenta.abonado
  const saldo = pedido.total - abonadoTotal

  const filas: Array<[string, string, boolean]> = abono
    ? [
        ['Total', dinero(pedido.total), false],
        ['Abonado antes', dinero(abonadoAntes), false],
        ['Este abono', dinero(abono.monto), true],
        ['Saldo pendiente', dinero(Math.max(saldo, 0)), false],
      ]
    : [
        ['Total', dinero(pedido.total), false],
        ['Abonado', dinero(abonadoTotal), true],
        ['Saldo pendiente', dinero(Math.max(saldo, 0)), false],
      ]

  const altoCuadro = filas.length * 46 + 28
  ctx.fillStyle = '#f6f7f9'
  rectRedondo(ctx, MARGEN, y, anchoUtil, altoCuadro, 16)
  ctx.fill()

  let yFila = y + 46
  for (const [nombre, monto, fuerte] of filas) {
    ctx.textAlign = 'left'
    ctx.fillStyle = fuerte ? tinta : suave
    ctx.font = `${fuerte ? '700 24px' : '400 22px'} system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.fillText(nombre, MARGEN + 24, yFila)
    ctx.textAlign = 'right'
    ctx.fillStyle = tinta
    ctx.font = `${fuerte ? '700 28px' : '500 22px'} system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.fillText(monto, ANCHO - MARGEN - 24, yFila)
    yFila += 46
  }
  y += altoCuadro + 34

  // --- Historial de abonos (solo en el estado de cuenta) ---
  if (!abono && cuenta.abonos.length) {
    etiqueta('Abonos recibidos')
    for (const a of cuenta.abonos) {
      ctx.textAlign = 'left'
      ctx.fillStyle = suave
      ctx.font = '400 20px system-ui, -apple-system, "Segoe UI", sans-serif'
      const metodo = a.metodo ? ` · ${ETIQUETA_METODO[a.metodo]}` : ''
      const folioTexto = a.folio ? `#${String(a.folio).padStart(4, '0')} · ` : ''
      ctx.fillText(`${folioTexto}${fechaLegible(a.fecha)}${metodo}`, MARGEN, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = tinta
      ctx.font = '600 22px system-ui, -apple-system, "Segoe UI", sans-serif'
      ctx.fillText(dinero(a.monto), ANCHO - MARGEN, y)
      y += 42
    }
    y += 10
  }

  // --- Metodo de pago del abono ---
  if (abono?.metodo) {
    ctx.textAlign = 'left'
    ctx.fillStyle = suave
    ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(`Pagado con ${ETIQUETA_METODO[abono.metodo].toLowerCase()}`, MARGEN, y)
    y += 40
  }

  // --- Pie ---
  ctx.strokeStyle = linea
  ctx.beginPath()
  ctx.moveTo(MARGEN, y - 10)
  ctx.lineTo(ANCHO - MARGEN, y - 10)
  ctx.stroke()
  y += 28

  ctx.textAlign = 'center'
  ctx.fillStyle = '#9ca3af'
  ctx.font = '400 19px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(
    saldo <= 0.005 ? 'Pagado por completo. ¡Gracias por tu compra!' : '¡Gracias por tu compra!',
    ANCHO / 2,
    y,
  )
  y += 34

  // --- Recorte final ---
  canvas.width = ANCHO * ESCALA
  canvas.height = Math.round(y * ESCALA)
  canvas.style.width = '100%'
  canvas.style.height = 'auto'
  canvas.getContext('2d')!.drawImage(lienzo, 0, 0)
}

export function Recibo({ pedido, origen, movimientos, abono, onCerrar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [listo, setListo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelado = false
    dibujarRecibo(canvas, { pedido, origen, movimientos, abono }).then(() => {
      if (!cancelado) setListo(true)
    })
    return () => {
      cancelado = true
    }
  }, [pedido, origen, movimientos, abono])

  const nombreArchivo = `recibo_${(origen.nombre || 'negocio')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}_${abono?.folio ? String(abono.folio).padStart(4, '0') : pedido.fecha}.png`

  const conImagen = useCallback(
    (accion: (blob: Blob) => void) => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.toBlob((blob) => {
        if (!blob) {
          setAviso('No se pudo generar la imagen.')
          return
        }
        accion(blob)
      }, 'image/png')
    },
    [],
  )

  function descargar() {
    conImagen((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivo
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      setAviso('Imagen descargada. Busca el recibo en tus descargas o en la galeria.')
    })
  }

  function compartir() {
    conImagen(async (blob) => {
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' })
      try {
        await navigator.share({ files: [archivo], title: 'Recibo' })
      } catch {
        /* si el usuario cancela no hay nada que avisar */
      }
    })
  }

  const puedeCompartir =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] })

  return (
    <Modal
      titulo={abono ? 'Recibo de abono' : 'Estado de cuenta'}
      subtitulo="Asi lo va a ver tu cliente"
      ancho
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn fantasma" onClick={onCerrar}>
            Cerrar
          </button>
          {puedeCompartir && (
            <button className="btn" onClick={compartir} disabled={!listo}>
              Compartir
            </button>
          )}
          <button className="btn primario" onClick={descargar} disabled={!listo}>
            Descargar imagen
          </button>
        </>
      }
    >
      <div className="lienzo-recibo">
        <canvas ref={canvasRef} />
      </div>
      {aviso && (
        <div className="alerta bien">
          <span className="alerta-icono">✅</span>
          <div className="alerta-titulo">{aviso}</div>
        </div>
      )}
    </Modal>
  )
}
