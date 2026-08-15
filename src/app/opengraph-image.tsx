import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

/*
  Imagen que muestran WhatsApp / iMessage / redes al pegar un link del studio
  (incluye /ver, que hereda esta imagen del layout raíz).

  El logo es BLANCO con fondo transparente: pegado tal cual quedaría invisible
  sobre el fondo blanco de una preview. Por eso se compone acá sobre el mismo
  fondo oscuro del configurador.
*/

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'GerstnerWerks'

export default async function Image() {
  const logo = await readFile(path.join(process.cwd(), 'public/img/logo-werks.png'))
  const src = `data:image/png;base64,${logo.toString('base64')}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Satori no soporta radial-gradient: se aproxima el fondo del studio
          // con un lineal del mismo rango de grises.
          backgroundImage: 'linear-gradient(160deg, #3a3c42 0%, #1e2024 45%, #0e0f12 100%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={700} height={359} alt="GerstnerWerks" />
      </div>
    ),
    size,
  )
}
