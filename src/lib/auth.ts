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

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

export async function tokenDe(password: string): Promise<string> {
  const data = new TextEncoder().encode(`gw-studio-v1:${password}`)
  return hex(await crypto.subtle.digest('SHA-256', data))
}

/* ── LINK DE RECUPERACIÓN ──
   Token autocontenido `vence.firma`: no necesita guardar nada. La firma es un
   HMAC con la clave del editor, así que solo el servidor puede emitirlo y
   cambiar la clave invalida los links viejos. Vence a los 15 minutos. */

const VENCIMIENTO_MS = 15 * 60 * 1000

async function firmar(mensaje: string, secreto: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mensaje)))
}

export async function crearTokenRecuperacion(clave: string, ahora: number): Promise<string> {
  const vence = ahora + VENCIMIENTO_MS
  return `${vence}.${await firmar(String(vence), clave)}`
}

export async function validarTokenRecuperacion(token: string, clave: string, ahora: number): Promise<boolean> {
  const [vence, firma] = (token || '').split('.')
  if (!vence || !firma) return false
  const n = Number(vence)
  if (!Number.isFinite(n) || n < ahora) return false
  const esperada = await firmar(vence, clave)
  // Comparación de tiempo constante: no filtra cuánto coincide por el tiempo.
  if (firma.length !== esperada.length) return false
  let dif = 0
  for (let i = 0; i < firma.length; i++) dif |= firma.charCodeAt(i) ^ esperada.charCodeAt(i)
  return dif === 0
}

/* Enmascara un mail para MOSTRARLO sin revelarlo: la dirección de recuperación
   nunca se expone al navegador (pedido explícito). "juan@gmail.com" → "j···".
   Devuelve solo la primera letra: ni dominio ni largo real. */
export function mailEnmascarado(mail: string): string {
  const inicial = (mail || '').trim()[0] || '·'
  return `${inicial}···`
}
