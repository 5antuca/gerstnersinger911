'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

// Puerta del editor. El visor de clientes (/ver) NO pasa por acá.
function Form() {
  const router = useRouter()
  const params = useSearchParams()
  const destino = params.get('next') || '/'
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [canjeando, setCanjeando] = useState(!!token)

  const entrar = async (payload: { password?: string; token?: string }) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      // replace: el login no queda en el historial (el "atrás" no vuelve acá).
      // Y así el token del link desaparece de la barra de direcciones.
      router.replace(destino)
      router.refresh()
      return true
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setError(data.error || 'No se pudo entrar.')
    return false
  }

  // Link de recuperación: entra solo al abrirlo.
  useEffect(() => {
    if (!token) return
    ;(async () => {
      const ok = await entrar({ token })
      if (!ok) setCanjeando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const porClave = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    setAviso('')
    try {
      await entrar({ password })
    } catch {
      setError('Sin conexión con el servidor.')
    }
    setEnviando(false)
  }

  const recuperar = async () => {
    setEnviando(true)
    setError('')
    setAviso('')
    try {
      const res = await fetch('/api/recuperar', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { destino?: string; error?: string }
      // `destino` viene enmascarado desde el servidor (solo la inicial).
      if (res.ok) setAviso(`Mail enviado a ${data.destino ?? '···'}`)
      else setError(data.error || 'No se pudo enviar el mail.')
    } catch {
      setError('Sin conexión con el servidor.')
    }
    setEnviando(false)
  }

  if (canjeando) {
    return <p className="text-sm text-white/50">Entrando…</p>
  }

  return (
    <form onSubmit={porClave} className="w-full max-w-[280px] flex flex-col items-center gap-4">
      <Image src="/img/logopage.webp" alt="GerstnerWerks" width={180} height={60} className="w-[130px] h-auto object-contain mb-2" priority />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Clave"
        autoFocus
        autoComplete="current-password"
        inputMode="numeric"
        className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40 transition-colors text-center tracking-[0.3em]"
      />
      <button
        type="submit"
        disabled={enviando || !password}
        className="w-full rounded-full bg-white text-black text-sm font-medium py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition-all"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      {error && <p className="text-xs text-red-300/80 text-center">{error}</p>}
      {aviso && <p className="text-xs text-emerald-200/80 text-center">{aviso}</p>}

      <button
        type="button"
        onClick={recuperar}
        disabled={enviando}
        className="text-[11px] text-white/35 hover:text-white/70 transition-colors disabled:opacity-40"
      >
        ¿Olvidaste la clave?
      </button>

      <a href="/ver" className="text-[11px] text-white/25 hover:text-white/60 transition-colors">
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
