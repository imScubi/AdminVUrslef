import type { Origen } from '../tipos'

/**
 * La cara del negocio: su logo si lo tiene, y si no el emoji.
 *
 * Ponerlo en las tarjetas y encabezados hace visible que los logos existen;
 * antes solo se veian dentro del recibo, asi que la opcion pasaba
 * desapercibida al fondo del formulario de editar.
 */
export function AvatarOrigen({
  origen,
  tamano = 34,
  redondeo,
}: {
  origen: Origen
  tamano?: number
  redondeo?: number
}) {
  const estilo = {
    width: tamano,
    height: tamano,
    borderRadius: redondeo ?? Math.round(tamano * 0.3),
    background: `${origen.color}1f`,
  }

  if (origen.logo) {
    return (
      <span className="avatar-negocio" style={estilo}>
        <img src={origen.logo} alt="" />
      </span>
    )
  }

  return (
    <span className="avatar-negocio" style={{ ...estilo, fontSize: tamano * 0.52 }}>
      {origen.emoji}
    </span>
  )
}
