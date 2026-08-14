import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, tokenDe } from '@/lib/auth'

// Valida la clave del editor contra STUDIO_PASSWORD y deja la cookie de sesión.
// La cookie es httpOnly: no se puede leer desde JS del navegador.
export async function POST(req: NextRequest) {
  const clave = process.env.STUDIO_PASSWORD
  if (!clave) {
    return NextResponse.json({ error: 'No hay clave configurada en el servidor.' }, { status: 501 })
  }
  let password = ''
  try {
    password = ((await req.json()) as { password?: string }).password ?? ''
  } catch {
    return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  }
  if (password !== clave) {
    return NextResponse.json({ error: 'Clave incorrecta.' }, { status: 401 })
  }
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
