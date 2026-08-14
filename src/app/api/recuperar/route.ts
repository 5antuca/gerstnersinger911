import { NextRequest, NextResponse } from 'next/server'
import { crearTokenRecuperacion, mailEnmascarado } from '@/lib/auth'
import { ipDe, limitar } from '@/lib/ratelimit'

/*
  "¿Olvidaste la clave?" → manda un link de acceso al mail de recuperación.

  La dirección vive SOLO en el servidor (RECOVERY_EMAIL) y NUNCA viaja al
  navegador: la respuesta devuelve apenas la inicial ("s···"). El destino es
  fijo, no lo elige quien llama, así que este endpoint no sirve para mandarle
  mails a terceros.

  Se manda un LINK de acceso temporal (15 min), no la clave: un mail queda
  guardado para siempre en la casilla y la clave no debería estar ahí.
*/

const origenDe = (req: NextRequest) => {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return host ? `${proto}://${host}` : req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const clave = process.env.STUDIO_PASSWORD
  const destino = process.env.RECOVERY_EMAIL
  const apiKey = process.env.RESEND_API_KEY
  // Resend acepta este remitente sin verificar dominio; con dominio propio
  // verificado, poner MAIL_FROM = algo@gerstnerwerks.com.
  const remitente = process.env.MAIL_FROM || 'GerstnerWerks <onboarding@resend.dev>'

  if (!clave || !destino) {
    return NextResponse.json({ error: 'La recuperación no está configurada.' }, { status: 501 })
  }

  // 3 pedidos por hora y por IP, y 10 en total por hora: que nadie te llene
  // la casilla apretando el botón.
  const porIp = await limitar(`recuperar:${ipDe(req)}`, 3, 3600)
  const global = await limitar('recuperar:global', 10, 3600)
  if (!porIp.permitido || !global.permitido) {
    return NextResponse.json(
      { error: 'Ya se enviaron varios mails. Esperá unos minutos.' },
      { status: 429 },
    )
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Falta configurar el envío de mails.' }, { status: 501 })
  }

  const token = await crearTokenRecuperacion(clave, Date.now())
  const link = `${origenDe(req)}/login?token=${encodeURIComponent(token)}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remitente,
        to: [destino],
        subject: 'Acceso al editor — GerstnerWerks Studio',
        text:
          `Entrá al editor con este link (vence en 15 minutos):\n\n${link}\n\n` +
          `Si no lo pediste vos, ignorá este mail: el link solo sirve por un rato ` +
          `y no cambia la clave.`,
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[recuperar] Resend respondió', res.status, await res.text())
      return NextResponse.json({ error: 'No se pudo enviar el mail.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[recuperar] error de red', e)
    return NextResponse.json({ error: 'No se pudo enviar el mail.' }, { status: 502 })
  }

  // Solo la inicial: el navegador nunca ve la dirección completa.
  return NextResponse.json({ ok: true, destino: mailEnmascarado(destino) })
}
