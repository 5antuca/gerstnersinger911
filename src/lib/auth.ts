/*
  Clave del EDITOR. El visor de cliente (/ver) es público; el editor (/) y las
  escrituras de perfiles piden clave.

  La clave vive SOLO en la variable de entorno STUDIO_PASSWORD (Vercel →
  Settings → Environment Variables). Nunca se hardcodea ni se commitea.

  La cookie NO guarda la clave: guarda un SHA-256 derivado de ella, así el
  valor de la cookie no sirve para nada fuera de este sitio y no expone la
  clave si alguien mira sus cookies. Falsificarla exige conocer la clave.

  Se usa Web Crypto (no node:crypto) porque el middleware corre en el runtime
  edge, donde node:crypto no está disponible.
*/

export const COOKIE = 'gw_studio'

export async function tokenDe(password: string): Promise<string> {
  const data = new TextEncoder().encode(`gw-studio-v1:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
