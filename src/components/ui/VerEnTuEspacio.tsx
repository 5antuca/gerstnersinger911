'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cargarModelViewer, exportarAutoGLB } from '@/lib/ar'

/*
  "Ver en tu espacio": el auto configurado, en tamaño real, con la cámara del
  celular (Android → WebXR, iPhone → Quick Look). Ver src/lib/ar.ts.

  Dos toques a propósito: el primero prepara (exporta el auto + carga el visor,
  que tarda), el segundo abre el AR. iOS solo deja abrir Quick Look desde un
  toque del usuario; si se abriera al terminar de preparar, ese toque ya se
  "gastó" y Safari lo bloquea.
*/

type Estado = 'cerrado' | 'preparando' | 'listo' | 'error'

type ModelViewer = HTMLElement & {
  canActivateAR?: boolean
  activateAR?: () => Promise<void>
}

export function VerEnTuEspacio({ className }: { className: string }) {
  const [estado, setEstado] = useState<Estado>('cerrado')
  const [url, setUrl] = useState<string | null>(null)
  // null = el visor todavía no cargó el auto; después, si este celular soporta AR.
  const [soportaAR, setSoportaAR] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const contRef = useRef<HTMLDivElement>(null)
  const mvRef = useRef<ModelViewer | null>(null)

  const preparar = async () => {
    setEstado('preparando')
    setError('')
    try {
      const [blob] = await Promise.all([exportarAutoGLB(), cargarModelViewer()])
      setUrl(URL.createObjectURL(blob))
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEstado('error')
    }
  }

  const cerrar = () => {
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    setSoportaAR(null)
    setEstado('cerrado')
  }

  // <model-viewer> se arma a mano (es un web component, no hay tipos de JSX).
  useEffect(() => {
    const cont = contRef.current
    if (estado !== 'listo' || !url || !cont) return
    const mv = document.createElement('model-viewer') as ModelViewer
    mv.setAttribute('src', url)
    mv.setAttribute('alt', 'Tu auto configurado')
    mv.setAttribute('ar', '')
    mv.setAttribute('ar-modes', 'webxr quick-look')
    // Tamaño real fijo: sin esto el usuario puede achicarlo con dos dedos.
    mv.setAttribute('ar-scale', 'fixed')
    mv.setAttribute('ar-placement', 'floor')
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('camera-orbit', '35deg 75deg auto')
    mv.setAttribute('shadow-intensity', '1')
    mv.style.width = '100%'
    mv.style.height = '100%'
    mv.style.setProperty('--poster-color', 'transparent')
    // Sin el botón de AR propio de model-viewer: usamos el nuestro.
    const sinBoton = document.createElement('span')
    sinBoton.setAttribute('slot', 'ar-button')
    sinBoton.style.display = 'none'
    mv.appendChild(sinBoton)

    const alCargar = () => setSoportaAR(!!mv.canActivateAR)
    const alEstadoAR = (e: Event) => {
      if ((e as CustomEvent<{ status: string }>).detail?.status === 'failed') {
        setError('No se pudo abrir la realidad aumentada en este celular.')
      }
    }
    mv.addEventListener('load', alCargar)
    mv.addEventListener('ar-status', alEstadoAR)
    cont.appendChild(mv)
    mvRef.current = mv
    return () => {
      mv.removeEventListener('load', alCargar)
      mv.removeEventListener('ar-status', alEstadoAR)
      mv.remove()
      mvRef.current = null
    }
  }, [estado, url])

  const modal =
    estado === 'cerrado' ? null : (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
        <div className="relative flex h-full max-h-[440px] w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/90 text-white">
          <button
            onClick={cerrar}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div ref={contRef} className="relative min-h-0 flex-1">
            {estado === 'preparando' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <p className="text-sm">Preparando tu auto…</p>
              </div>
            )}
            {estado === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
                {error}
              </div>
            )}
          </div>

          {estado === 'listo' && (
            <div className="flex flex-col items-center gap-1.5 border-t border-white/10 px-4 py-3">
              {soportaAR === false ? (
                <p className="text-center text-xs text-white/60">
                  Para verlo en tamaño real, abrí esta página desde un celular: Android con Chrome o iPhone con Safari.
                </p>
              ) : (
                <>
                  <button
                    onClick={() => mvRef.current?.activateAR?.()}
                    disabled={!soportaAR}
                    className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-40"
                  >
                    {soportaAR ? 'Ver en tu espacio' : 'Cargando…'}
                  </button>
                  <p className="text-[11px] text-white/50">Apuntá al piso y el auto aparece en tamaño real.</p>
                </>
              )}
              {error && <p className="text-center text-[11px] text-red-300/80">{error}</p>}
            </div>
          )}
        </div>
      </div>
    )

  return (
    <>
      <button onClick={preparar} className={className} aria-label="Ver en tu espacio, en tamaño real">
        {/* cubo en perspectiva: el ícono habitual de "ver en AR" */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
          <path d="M12 11l8-4.5M12 11L4 6.5M12 11v9" />
        </svg>
        <span className="font-medium tracking-wide">Ver en tu espacio</span>
      </button>
      {modal && createPortal(modal, document.body)}
    </>
  )
}
