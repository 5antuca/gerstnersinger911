import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

/*
  Ícono de la pestaña (y el que usan WhatsApp/iOS como miniatura cuadrada).

  Se usa la "G" y no el logo largo: a 32px el "Gerstner Werks" completo es
  ilegible. Y va sobre fondo oscuro porque la G es BLANCA con transparencia:
  suelta desaparecería en una barra de pestañas clara.

  Reemplaza al favicon.ico por defecto de Next (el triángulo), que era el que
  se veía en la pestaña y en la preview de WhatsApp.
*/

export const size = { width: 256, height: 256 }
export const contentType = 'image/png'

export default async function Icon() {
  const g = await readFile(path.join(process.cwd(), 'public/img/logo-g.png'))
  const src = `data:image/png;base64,${g.toString('base64')}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16181c',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={200} height={200} alt="G" />
      </div>
    ),
    size,
  )
}
