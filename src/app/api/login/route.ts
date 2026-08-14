import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, tokenDe, validarTokenRecuperacion } from '@/lib/auth'
import { ipDe, limitar } from '@/lib/ratelimit'

// Cookie de sesión del editor. httpOnly: no se puede leer desde JS.
async function conSesion(clave: string) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, await tokenDe(clave), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // 180 días: no querés reloguear todo el tiempo
  })
  return res
}

/*
  Entra al editor de dos formas:
   - `password`: la clave de STUDIO_PASSWORD.
   - `token`:    el link de recuperación que llegó por mail.

  Con freno de intentos por IP, porque la clave es un PIN corto.
*/
export async function POST(req: NextRequest) {
  const clave = process.env.STUDIO_PASSWORD
  if (!clave) {
    return NextResponse.json({ error: 'No hay clave configurada en el servidor.' }, { status: 501 })
  }

  let body: { password?: string; token?: string }
  try {
    body = (await req.json()) as { password?: string; token?: string }
  } catch {
    return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  }

  // 10 intentos cada 10 minutos por IP.
  const { permitido } = await limitar(`login:${ipDe(req)}`, 10, 600)
  if (!permitido) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
      { status: 429 },
    )
  }

  if (body.token) {
    const vale = await validarTokenRecuperacion(body.token, clave, Date.now())
    if (!vale) {
      return NextResponse.json({ error: 'El link venció o no es válido.' }, { status: 401 })
    }
    return conSesion(clave)
  }

  if ((body.password ?? '') !== clave) {
    return NextResponse.json({ error: 'Clave incorrecta.' }, { status: 401 })
  }
  return conSesion(clave)
}
