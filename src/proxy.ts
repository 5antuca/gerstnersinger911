import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, tokenDe } from '@/lib/auth'

/*
  Puerta del editor.

  PÚBLICO (sin clave):
    /ver            visor de cliente
    /login          formulario
    /api/login      valida la clave (o canjea el link de recuperación)
    /api/recuperar  manda el link de acceso al mail de recuperación
    GET /api/perfiles   el visor necesita leer los presets

  CON CLAVE:
    /                          editor completo
    PUT/DELETE /api/perfiles   guardar y borrar presets

  Si STUDIO_PASSWORD no está seteada la puerta queda ABIERTA a propósito:
  preferimos que el editor siga entrando a que un olvido de configuración deje
  al dueño afuera de su propia herramienta. Mientras no la setees, /ver anda
  igual pero el editor no está protegido.
*/

const PUBLICO = ['/ver', '/login', '/api/login', '/api/recuperar']

export async function proxy(req: NextRequest) {
  const clave = process.env.STUDIO_PASSWORD
  if (!clave) return NextResponse.next()

  const { pathname } = req.nextUrl
  if (PUBLICO.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next()
  if (pathname.startsWith('/api/perfiles') && req.method === 'GET') return NextResponse.next()

  const cookie = req.cookies.get(COOKIE)?.value
  if (cookie && cookie === (await tokenDe(clave))) return NextResponse.next()

  // La API responde 401 en vez de redirigir: un fetch no sabe seguir a un form.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Todo menos los internos de Next y cualquier archivo con extensión
  // (.glb, .jpg, .ico…): los modelos y las texturas son públicos.
  matcher: ['/((?!_next/static|_next/image|.*\\.).*)'],
}
