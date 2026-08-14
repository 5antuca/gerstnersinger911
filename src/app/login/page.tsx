'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

// Puerta del editor. El visor de clientes (/ver) NO pasa por acá.
function Form() {
  const router = useRouter()
  const params = useSearchParams()
  const destino = params.get('next') || '/'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // replace: el login no queda en el historial (el "atrás" no vuelve acá)
        router.replace(destino)
        router.refresh()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error || 'No se pudo entrar.')
    } catch {
      setError('Sin conexión con el servidor.')
    }
    setEnviando(false)
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-[280px] flex flex-col items-center gap-4">
      <Image src="/img/logopage.webp" alt="GerstnerWerks" width={180} height={60} className="w-[130px] h-auto object-contain mb-2" priority />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Clave"
        autoFocus
        autoComplete="current-password"
        className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40 transition-colors"
      />
      <button
        type="submit"
        disabled={enviando || !password}
        className="w-full rounded-full bg-white text-black text-sm font-medium py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition-all"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
      {error && <p className="text-xs text-red-300/80 text-center">{error}</p>}
      <a href="/ver" className="text-[11px] text-white/30 hover:text-white/60 transition-colors mt-2">
        Ver el configurador sin editar
      </a>
    </form>
  )
}

export default function Login() {
  return (
    <main
      className="w-screen text-white flex items-center justify-center font-sans px-6"
      style={{ background: 'radial-gradient(ellipse at top, #3a3c42 0%, #1e2024 40%, #0e0f12 100%)', height: '100dvh' }}
    >
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </main>
  )
}
