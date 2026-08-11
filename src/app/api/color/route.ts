import { NextResponse } from 'next/server'

// Convierte el nombre/descripción de un color en un hex, con un LLM.
// Ej: "Porsche grey black", "rojo Ferrari", "verde bosque profundo", "gris nardo".
// Requiere OPENAI_API_KEY en el entorno del proyecto (Vercel → Settings → Env Vars).
export async function POST(req: Request) {
  let name = ''
  try {
    const body = (await req.json()) as { name?: unknown }
    name = String(body?.name ?? '').slice(0, 120).trim()
  } catch {
    /* body inválido */
  }
  if (!name) return NextResponse.json({ error: 'Falta el nombre del color' }, { status: 400 })

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'IA no configurada (falta OPENAI_API_KEY)' }, { status: 503 })
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0,
        max_tokens: 12,
        messages: [
          {
            role: 'system',
            content:
              'Sos un experto en colores de pintura automotriz. Te dan el nombre o la descripción de un color/pintura (de cualquier marca o época) y respondés SOLO con el hex más cercano en formato #RRGGBB, sin texto ni explicación. Si es un color de fábrica conocido (Porsche, Ferrari, Jaguar, Mercedes, etc.) usá su color real.',
          },
          { role: 'user', content: name },
        ],
      }),
    })
    if (!r.ok) return NextResponse.json({ error: 'Error del proveedor de IA' }, { status: 502 })
    const data = await r.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    const m = text.match(/#?([0-9a-fA-F]{6})/)
    if (!m) return NextResponse.json({ error: 'La IA no devolvió un color válido' }, { status: 422 })
    return NextResponse.json({ hex: `#${m[1].toLowerCase()}`, name })
  } catch {
    return NextResponse.json({ error: 'No se pudo contactar a la IA' }, { status: 502 })
  }
}
