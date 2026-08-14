/*
  Límite de intentos para los endpoints públicos de acceso.

  Importa sobre todo porque la clave del editor es un PIN corto: sin freno,
  probar las 10.000 combinaciones de 4 dígitos es cuestión de minutos. Con
  esto, cada IP tiene un puñado de intentos por ventana y el ataque deja de
  ser práctico.

  Usa el mismo Upstash Redis que los perfiles (INCR + EXPIRE, atómico y
  compartido entre las instancias serverless). Sin Redis configurado NO
  bloquea: en local no molesta y en prod es preferible que el editor siga
  entrando a que un problema de infraestructura deje a todos afuera.
  El contador nunca guarda la clave probada, solo cuántos intentos hubo.
*/

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

export type Limite = { permitido: boolean; restantes: number }

export async function limitar(clave: string, maximo: number, ventanaSeg: number): Promise<Limite> {
  if (!redisUrl()) return { permitido: true, restantes: maximo }
  try {
    const res = await fetch(`${redisUrl()}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken()}` },
      body: JSON.stringify([
        ['INCR', `gw:rl:${clave}`],
        ['EXPIRE', `gw:rl:${clave}`, ventanaSeg, 'NX'],
      ]),
      cache: 'no-store',
    })
    if (!res.ok) return { permitido: true, restantes: maximo }
    const out = (await res.json()) as { result: unknown }[]
    const cuenta = Number(out?.[0]?.result ?? 0)
    return { permitido: cuenta <= maximo, restantes: Math.max(0, maximo - cuenta) }
  } catch {
    return { permitido: true, restantes: maximo }
  }
}

// IP del visitante detrás del proxy de Vercel.
export function ipDe(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || ''
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida'
}
