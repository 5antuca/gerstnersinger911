import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/*
  Perfiles de color compartidos del configurador (disponibles desde cualquier
  dispositivo). Storage por orden de preferencia:

  1. Upstash Redis — prod. Se autoconfigura al conectar la integración
     "Upstash Redis" en Vercel (Storage → Create Database → Upstash, plan
     free): inyecta UPSTASH_REDIS_REST_URL/TOKEN (o KV_REST_API_URL/TOKEN).
  2. Archivo .dev-perfiles.json en la raíz — solo `next dev` (gitignored).
  3. Sin storage → GET responde {storage:'none'} y el cliente queda en
     localStorage (la web nunca se rompe por falta de backend).

  Modelo: HASH gw:perfiles (name → perfil JSON). BORRAR NUNCA DESTRUYE:
  mueve el perfil completo a gw:perfiles:trash con deletedAt (tombstone que
  además es backup recuperable). Re-guardar el mismo nombre lo saca de la
  papelera.
*/

type Perfil = { name: string; cfg: Record<string, unknown>; updatedAt?: number }
type Tumba = Perfil & { deletedAt: number }

const KEY = 'gw:perfiles'
const TRASH = 'gw:perfiles:trash'

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

async function redis(cmds: (string | number)[][]) {
  const res = await fetch(`${redisUrl()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken()}` },
    body: JSON.stringify(cmds),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  return (await res.json()) as { result: unknown }[]
}

// HGETALL por REST devuelve un array plano [field, value, field, value, ...]
function parseHash<T>(flat: unknown): T[] {
  const arr = (flat as string[]) || []
  const out: T[] = []
  for (let i = 1; i < arr.length; i += 2) {
    try {
      out.push(JSON.parse(arr[i]))
    } catch {
      /* entrada corrupta: se ignora, no rompe el resto */
    }
  }
  return out
}

// ── adapter de archivo para desarrollo local ──
const DEV_FILE = path.join(process.cwd(), '.dev-perfiles.json')
type FileDb = { perfiles: Record<string, Perfil>; trash: Record<string, Tumba> }
const useFile = () => !redisUrl() && process.env.NODE_ENV === 'development'
async function readFileDb(): Promise<FileDb> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, 'utf8'))
  } catch {
    return { perfiles: {}, trash: {} }
  }
}
async function writeFileDb(db: FileDb) {
  await fs.writeFile(DEV_FILE, JSON.stringify(db, null, 2))
}

export async function GET() {
  try {
    if (redisUrl()) {
      const [a, b] = await redis([
        ['HGETALL', KEY],
        ['HGETALL', TRASH],
      ])
      return NextResponse.json({
        storage: 'cloud',
        perfiles: parseHash<Perfil>(a.result),
        deleted: parseHash<Tumba>(b.result).map((t) => ({ name: t.name, deletedAt: t.deletedAt ?? 0 })),
      })
    }
    if (useFile()) {
      const db = await readFileDb()
      return NextResponse.json({
        storage: 'dev-file',
        perfiles: Object.values(db.perfiles),
        deleted: Object.values(db.trash).map((t) => ({ name: t.name, deletedAt: t.deletedAt })),
      })
    }
    return NextResponse.json({ storage: 'none', perfiles: [], deleted: [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const perfil = (await req.json()) as Perfil
    if (!perfil?.name || !perfil?.cfg) return NextResponse.json({ error: 'perfil inválido' }, { status: 400 })
    perfil.updatedAt ??= Date.now()
    if (redisUrl()) {
      await redis([
        ['HSET', KEY, perfil.name, JSON.stringify(perfil)],
        ['HDEL', TRASH, perfil.name],
      ])
      return NextResponse.json({ ok: true, storage: 'cloud' })
    }
    if (useFile()) {
      const db = await readFileDb()
      db.perfiles[perfil.name] = perfil
      delete db.trash[perfil.name]
      await writeFileDb(db)
      return NextResponse.json({ ok: true, storage: 'dev-file' })
    }
    return NextResponse.json({ error: 'sin storage configurado' }, { status: 501 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { name } = (await req.json()) as { name?: string }
    if (!name) return NextResponse.json({ error: 'falta name' }, { status: 400 })
    const deletedAt = Date.now()
    if (redisUrl()) {
      const [cur] = await redis([['HGET', KEY, name]])
      const perfil: Perfil = cur.result ? JSON.parse(cur.result as string) : { name, cfg: {} }
      await redis([
        ['HSET', TRASH, name, JSON.stringify({ ...perfil, deletedAt })],
        ['HDEL', KEY, name],
      ])
      return NextResponse.json({ ok: true })
    }
    if (useFile()) {
      const db = await readFileDb()
      db.trash[name] = { ...(db.perfiles[name] ?? { name, cfg: {} }), deletedAt }
      delete db.perfiles[name]
      await writeFileDb(db)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'sin storage configurado' }, { status: 501 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
