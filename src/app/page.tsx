'use client'

import { Suspense, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS, PRESET_ENVIRONMENTS } from '@/store/useConfiguratorStore'
import Image from 'next/image'
import Wheel from '@uiw/react-color-wheel'
import ShadeSlider from '@uiw/react-color-shade-slider'
import Alpha from '@uiw/react-color-alpha'
import { hexToHsva, hsvaToHex, type HsvaColor } from '@uiw/color-convert'

/* Selector RGB circular: rueda completa de color + brillo + opacidad.
   Controla un hex + un alpha del store del configurador. */
function ColorPickerRGB({
  hex,
  alpha,
  onHex,
  onAlpha,
  size = 150,
}: {
  hex: string
  alpha: number
  onHex: (hex: string) => void
  onAlpha: (alpha: number) => void
  size?: number
}) {
  const [hsva, setHsva] = useState<HsvaColor>(() => ({ ...hexToHsva(hex), a: alpha }))
  return (
    <div className="flex flex-col items-center gap-2.5">
      <Wheel
        color={hsva}
        width={size}
        height={size}
        onChange={(c) => {
          const next = { ...hsva, ...c.hsva, a: hsva.a }
          setHsva(next)
          onHex(hsvaToHex(next))
        }}
      />
      <ShadeSlider
        hsva={hsva}
        style={{ width: size }}
        onChange={(v) => {
          const next = { ...hsva, ...v }
          setHsva(next)
          onHex(hsvaToHex(next))
        }}
      />
      <Alpha
        hsva={hsva}
        style={{ width: size }}
        onChange={(v) => {
          const next = { ...hsva, a: v.a }
          setHsva(next)
          onAlpha(v.a)
        }}
      />
    </div>
  )
}

function LoadingScreen() {
  const { progress } = useProgress()
  const done = progress >= 99.9

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 pointer-events-none"
      style={{ opacity: done ? 0 : 1 }}
    >
      {/* Logo */}
      <Image
        src="/img/logopage.webp"
        alt="Gerstner Werks"
        width={120}
        height={40}
        className="object-contain opacity-60 mb-10"
        priority
      />

      {/* Thin progress bar */}
      <div className="w-40 h-[1px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/70 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Percentage */}
      <span className="mt-4 text-white/25 text-[10px] tracking-[0.3em] uppercase tabular-nums">
        {Math.round(progress)}%
      </span>
    </div>
  )
}

export default function Home() {
  const { paintColor, setPaintColor, paintAlpha, setPaintAlpha, decalColor, setDecalColor, decalAlpha, setDecalAlpha, rimStyle, setRimStyle, interiorColor, setInteriorColor, environment, setEnvironment, autoRotate, toggleAutoRotate } = useConfiguratorStore()
  const { progress } = useProgress()
  const isLoaded = progress >= 100

  // Estilos compartidos del bottom bar. Cada tab revela su panel SOLO al pasar el
  // cursor por encima (hover), via group-hover. El `pb-3` del wrapper hace de puente
  // entre el tab y el panel para que no se cierre al mover el cursor hacia arriba.
  const tabBtn = 'px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium tracking-wide text-white/65 group-hover:text-white group-hover:bg-white/10 transition-all duration-300 whitespace-nowrap'
  const popWrap = 'absolute bottom-full left-1/2 -translate-x-1/2 pb-3 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300'
  const popCard = 'bg-[#0a0a0a]/70 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl'
  const popTitle = 'text-[9px] font-semibold text-white/50 mb-2.5 tracking-widest uppercase text-center'
  const swatchCls = (active: boolean) =>
    `w-6 h-6 rounded-full cursor-pointer transition-all duration-300 ${
      active
        ? 'scale-110 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.25)]'
        : 'ring-1 ring-white/10 hover:ring-white/40'
    }`

  return (
    <main
      className="w-screen h-screen text-white overflow-hidden font-sans selection:bg-white/20 relative"
      style={{ background: 'radial-gradient(ellipse at top, #3a3c42 0%, #1e2024 40%, #0e0f12 100%)' }}
    >
      {/* Loading Screen — usa useProgress de drei para el progreso real del GLB */}
      <LoadingScreen />

      {/* 3D Canvas - siempre detrás, nítido (sin blur de tabs) */}
      <div className={`absolute inset-0 z-0 transition-all duration-[1200ms] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>

      {/* ── HEADER ── logo (izq, más grande/menos sombra) + botón pausar giro (der) */}
      <header className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-8 pt-4 sm:pt-6 pb-0 pointer-events-none transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Logo */}
        <div className="pointer-events-auto shrink-0">
          <Image
            src="/img/logopage.webp"
            alt="Gerstner Werks Logo"
            width={180}
            height={60}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] opacity-100 object-contain h-auto w-[100px] sm:w-[158px]"
            priority
          />
        </div>

        {/* Botón pausar / reanudar el giro automático del auto */}
        <button
          onClick={toggleAutoRotate}
          className="pointer-events-auto shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
          title={autoRotate ? 'Pausar giro' : 'Reanudar giro'}
          aria-label={autoRotate ? 'Pausar giro' : 'Reanudar giro'}
        >
          {autoRotate ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </header>

      {/* ── BOTTOM BAR ── tabs con menú hover (el panel sale al pasar el cursor) */}
      <nav className={`absolute bottom-6 left-0 right-0 z-30 flex justify-center px-3 pointer-events-none transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="pointer-events-auto bg-black/30 backdrop-blur-xl border border-white/10 rounded-full p-1 flex gap-0.5 sm:gap-1">

          {/* Pintura */}
          <div className="group relative">
            <button className={tabBtn}>Pintura</button>
            <div className={popWrap}>
              <div className={`${popCard} flex gap-6`}>
                {/* Pintura exterior: rueda RGB completa + brillo + opacidad */}
                <div className="flex flex-col items-center">
                  <h3 className={popTitle}>Pintura Exterior</h3>
                  <ColorPickerRGB
                    hex={paintColor}
                    alpha={paintAlpha}
                    onHex={setPaintColor}
                    onAlpha={setPaintAlpha}
                    size={150}
                  />
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-[170px] mt-3">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setPaintColor(color.hex)}
                        className={swatchCls(paintColor === color.hex)}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                        aria-label={`Pintura ${color.name}`}
                      />
                    ))}
                  </div>
                </div>
                {/* Adhesivos: mismo selector para franjas + banda PORSCHE */}
                <div className="flex flex-col items-center">
                  <h3 className={popTitle}>Adhesivos</h3>
                  <ColorPickerRGB
                    hex={decalColor}
                    alpha={decalAlpha}
                    onHex={setDecalColor}
                    onAlpha={setDecalAlpha}
                    size={150}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interior */}
          <div className="group relative">
            <button className={tabBtn}>Interior</button>
            <div className={popWrap}>
              <div className={`${popCard} flex flex-col items-center gap-3`}>
                <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10" style={{ width: 210, height: 210 }}>
                  {PRESET_INTERIORS.map((interior) => (
                    <Image
                      key={interior.id}
                      src={interior.image}
                      alt={interior.name}
                      fill
                      sizes="210px"
                      className={`object-cover transition-opacity duration-500 ${
                        interiorColor.id === interior.id ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-[240px]">
                  {PRESET_INTERIORS.map((interior) => (
                    <button
                      key={interior.id}
                      onClick={() => setInteriorColor(interior)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all duration-300 ${
                        interiorColor.id === interior.id
                          ? 'bg-white text-black'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: interior.hex }}
                      />
                      {interior.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Llantas */}
          <div className="group relative">
            <button className={tabBtn}>Llantas</button>
            <div className={popWrap}>
              <div className={popCard}>
                <h3 className={popTitle}>Diseño de Llantas</h3>
                <div className="flex flex-wrap gap-2 justify-center max-w-[260px]">
                  {PRESET_RIMS.map((rim) => (
                    <button
                      key={rim.id}
                      onClick={() => setRimStyle(rim)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${
                        rimStyle.id === rim.id
                          ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105'
                          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {rim.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Luz */}
          <div className="group relative">
            <button className={tabBtn}>Luz</button>
            <div className={popWrap}>
              <div className={popCard}>
                <h3 className={popTitle}>Iluminación</h3>
                <div className="flex flex-wrap gap-2 justify-center max-w-[200px]">
                  {PRESET_ENVIRONMENTS.map((env) => (
                    <button
                      key={env.id}
                      onClick={() => setEnvironment(env.id)}
                      className={swatchCls(environment === env.id)}
                      style={{ backgroundColor: env.swatch }}
                      title={env.name}
                      aria-label={`Iluminación ${env.name}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </nav>
    </main>
  )
}
