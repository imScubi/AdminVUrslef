import type { Rango } from '../lib/calculos'
import { construirRango, OPCIONES_RANGO, type IdRango } from '../lib/rangos'

export function SelectorRango({
  rango,
  onCambio,
}: {
  rango: Rango
  onCambio: (r: Rango) => void
}) {
  return (
    <div className="segmentado">
      {OPCIONES_RANGO.map((o) => (
        <button
          key={o.id}
          className={rango.id === o.id ? 'activo' : ''}
          onClick={() => onCambio(construirRango(o.id as IdRango))}
        >
          <span className="rango-largo">{o.etiqueta}</span>
          <span className="rango-corto">{o.corto}</span>
        </button>
      ))}
    </div>
  )
}
