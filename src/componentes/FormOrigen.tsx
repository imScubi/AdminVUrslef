import { useRef, useState } from 'react'
import type { Origen, TipoOrigen } from '../tipos'
import { ETIQUETA_TIPO_ORIGEN } from '../tipos'
import { useTienda } from '../estado/tienda'
import { aNumero } from '../lib/formato'
import { hoy } from '../lib/fechas'
import { Modal } from './ui'

const COLORES = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
]

const EMOJIS = [
  '💼', '📦', '👕', '👟', '📱', '💻', '🎮', '🍰', '☕', '🚗',
  '💅', '✂️', '🎨', '📸', '🔧', '🏠', '📈', '🪙', '🎁', '🧃',
]

const LADO_LOGO = 320

/** Reduce el logo antes de guardarlo: si no, cada sincronizacion cargaria
 *  una imagen de camara completa. */
function encogerLogo(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'))
    lector.onload = () => {
      const img = new Image()
      img.onerror = () => rechazar(new Error('Ese archivo no parece una imagen.'))
      img.onload = () => {
        const escala = Math.min(1, LADO_LOGO / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        const ctx = canvas.getContext('2d')
        if (!ctx) return rechazar(new Error('No se pudo procesar la imagen.'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolver(canvas.toDataURL('image/png'))
      }
      img.src = String(lector.result)
    }
    lector.readAsDataURL(archivo)
  })
}

export function FormOrigen({
  origen,
  onCerrar,
}: {
  origen?: Origen
  onCerrar: (id?: string) => void
}) {
  const { agregarOrigen, editarOrigen, agregarMovimiento, db } = useTienda()

  const [nombre, setNombre] = useState(origen?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoOrigen>(origen?.tipo ?? 'reventa')
  const [color, setColor] = useState(origen?.color ?? COLORES[db.origenes.length % COLORES.length])
  const [emoji, setEmoji] = useState(origen?.emoji ?? '📦')
  const [metaMensual, setMetaMensual] = useState(
    origen?.metaMensual ? String(origen.metaMensual) : '',
  )
  const [notas, setNotas] = useState(origen?.notas ?? '')
  const [logo, setLogo] = useState(origen?.logo ?? '')
  const [contacto, setContacto] = useState(origen?.contacto ?? '')
  const archivoRef = useRef<HTMLInputElement>(null)
  const [capitalInicial, setCapitalInicial] = useState('')
  const [error, setError] = useState<string | null>(null)

  function enviar() {
    if (!nombre.trim()) {
      setError('Ponle un nombre al origen.')
      return
    }
    const datos = {
      nombre: nombre.trim(),
      tipo,
      color,
      emoji,
      metaMensual: aNumero(metaMensual),
      notas: notas.trim(),
      archivado: origen?.archivado ?? false,
      logo: logo || undefined,
      contacto: contacto.trim() || undefined,
    }

    if (origen) {
      editarOrigen(origen.id, datos)
      onCerrar(origen.id)
      return
    }

    const creado = agregarOrigen(datos)
    const capital = aNumero(capitalInicial)
    if (capital > 0) {
      agregarMovimiento({
        tipo: 'aporte',
        origenId: creado.id,
        fecha: hoy(),
        monto: capital,
        concepto: 'Capital inicial',
      })
    }
    onCerrar(creado.id)
  }

  return (
    <Modal
      titulo={origen ? 'Editar origen' : 'Nuevo origen de ingreso'}
      subtitulo="Cada origen es una caja aparte: su dinero, sus gastos y sus numeros no se mezclan con los demas."
      onCerrar={() => onCerrar()}
      pie={
        <>
          <button className="btn fantasma" onClick={() => onCerrar()}>
            Cancelar
          </button>
          <button className="btn primario" onClick={enviar}>
            {origen ? 'Guardar cambios' : 'Crear origen'}
          </button>
        </>
      }
    >
      <div className="fila">
        <div className="campo" style={{ flex: '2 1 220px' }}>
          <label htmlFor="or-nombre">Nombre</label>
          <input
            id="or-nombre"
            type="text"
            autoFocus
            placeholder="Ej. Reventa de tenis"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="or-tipo">Tipo</label>
          <select id="or-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoOrigen)}>
            {Object.entries(ETIQUETA_TIPO_ORIGEN).map(([id, etiqueta]) => (
              <option key={id} value={id}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="campo">
        <label>Logo y datos del recibo</label>
        <span className="ayuda">
          Esto es lo que sale impreso cuando le das un recibo a un cliente.
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          <div className="caja-logo">
            {logo ? <img src={logo} alt="Logo del negocio" /> : <span>Sin logo</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn chico" onClick={() => archivoRef.current?.click()}>
              {logo ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logo && (
              <button className="btn chico fantasma" onClick={() => setLogo('')}>
                Quitar
              </button>
            )}
          </div>
          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (!archivo) return
              try {
                setLogo(await encogerLogo(archivo))
                setError(null)
              } catch (problema) {
                setError(problema instanceof Error ? problema.message : 'No se pudo usar la imagen.')
              }
            }}
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="or-contacto">Contacto para el recibo (opcional)</label>
        <input
          id="or-contacto"
          type="text"
          placeholder="Tel. 55 1234 5678 · @minegocio"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Icono</label>
        <span className="ayuda">
          {logo ? 'Con logo puesto, el icono ya no se usa.' : 'Se usa mientras no subas un logo.'}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className="btn chico"
              style={{
                fontSize: '1.05rem',
                padding: '4px 7px',
                borderColor: e === emoji ? 'var(--acento)' : undefined,
                background: e === emoji ? 'var(--acento-suave)' : undefined,
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label>Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {COLORES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: c,
                border: c === color ? '2px solid var(--texto)' : '1px solid var(--borde)',
                cursor: 'pointer',
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 46, flex: 'none' }}
            aria-label="Color personalizado"
          />
        </div>
      </div>

      <div className="fila">
        <div className="campo">
          <label htmlFor="or-meta">Meta de ganancia mensual (opcional)</label>
          <div className="entrada-monto">
            <input
              id="or-meta"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={metaMensual}
              onChange={(e) => setMetaMensual(e.target.value)}
            />
          </div>
        </div>
        {!origen && (
          <div className="campo">
            <label htmlFor="or-capital">Capital con el que arranca (opcional)</label>
            <div className="entrada-monto">
              <input
                id="or-capital"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={capitalInicial}
                onChange={(e) => setCapitalInicial(e.target.value)}
              />
            </div>
            <span className="ayuda">Se registra como aporte y sirve para medir el ROI.</span>
          </div>
        )}
      </div>

      <div className="campo">
        <label htmlFor="or-notas">Notas</label>
        <textarea
          id="or-notas"
          placeholder="Proveedores, reglas que te pones, donde vendes…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {error && (
        <div className="alerta peligro">
          <span className="alerta-icono">⚠️</span>
          <div className="alerta-titulo">{error}</div>
        </div>
      )}
    </Modal>
  )
}
