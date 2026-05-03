'use client'

import { useState, Suspense } from 'react'
import { useProgress } from '@react-three/drei'
import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS } from '@/store/useConfiguratorStore'
import Image from 'next/image'

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

type Tab = 'general' | 'interior' | 'llantas' | 'escape'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'interior', label: 'Interior' },
  { id: 'llantas', label: 'Llantas' },
  { id: 'escape', label: 'Escape' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const { paintColor, setPaintColor, rimStyle, setRimStyle, interiorColor, setInteriorColor } = useConfiguratorStore()
  const { progress } = useProgress()
  const isLoaded = progress >= 100

  return (
    <main
      className="w-screen h-screen text-white overflow-hidden font-sans selection:bg-white/20 relative"
      style={{ background: 'radial-gradient(ellipse at top, #565963 0%, #2e3138 40%, #181a1f 100%)' }}
    >
      {/* Loading Screen — usa useProgress de drei para el progreso real del GLB */}
      <LoadingScreen />

      {/* 3D Canvas - always behind */}
      <div className={`absolute inset-0 z-0 transition-all duration-500 ${activeTab !== 'general' && activeTab !== 'llantas' ? 'blur-sm brightness-50' : ''}`}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>

      {/* ── HEADER ── */}
      <header className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 pt-6 pb-0 pointer-events-none transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Logo */}
        <div className="pointer-events-auto">
          <Image
            src="/img/logopage.webp"
            alt="Gerstner Werks Logo"
            width={130}
            height={44}
            className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] opacity-95 object-contain"
            priority
          />
        </div>

        {/* Navigation Tabs */}
        <nav className="pointer-events-auto">
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-full p-1 flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white text-black shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Spacer to balance logo */}
        <div className="w-[130px]" />
      </header>

      {/* ── INTERIOR OVERLAY ── */}
      {activeTab === 'interior' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 pointer-events-none">
          {/* Image viewer — proporción 1:1 nativa */}
          <div 
            className="relative pointer-events-auto rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: 'min(55vh, 460px)', height: 'min(55vh, 460px)' }}
          >
            {PRESET_INTERIORS.map((interior) => (
              <Image
                key={interior.id}
                src={interior.image}
                alt={interior.name}
                fill
                sizes="460px"
                className={`object-cover transition-opacity duration-700 ease-in-out ${
                  interiorColor.id === interior.id ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
                style={{ position: 'absolute' }}
              />
            ))}
            {/* subtle border */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 pointer-events-none z-20" />
          </div>

          {/* Interior options pill */}
          <div className="pointer-events-auto bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex gap-1">
            {PRESET_INTERIORS.map((interior) => (
              <button
                key={interior.id}
                onClick={() => setInteriorColor(interior)}
                className={`px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2.5 transition-all duration-300 ${
                  interiorColor.id === interior.id
                    ? 'bg-white text-black shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: interior.hex }}
                />
                {interior.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ESCAPE PLACEHOLDER ── */}
      {activeTab === 'escape' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-white/40 text-sm tracking-widest uppercase">Próximamente</p>
            <p className="text-white text-xl font-semibold mt-2">Configuración de Escape</p>
          </div>
        </div>
      )}

      {/* ── BOTTOM CONTROLS ── */}
      <div className={`absolute bottom-8 left-8 right-8 z-20 pointer-events-none flex gap-6 justify-center transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Paint selector — General tab */}
        {activeTab === 'general' && (
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl pointer-events-auto hover:bg-[#0a0a0a]/80 transition-colors duration-500">
            <h3 className="text-[10px] font-semibold text-white/50 mb-4 tracking-widest uppercase">Pintura Exterior</h3>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setPaintColor(color.hex)}
                  className={`w-10 h-10 rounded-full cursor-pointer transition-all duration-300 ${
                    paintColor === color.hex
                      ? 'scale-110 ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.25)]'
                      : 'ring-2 ring-white/10 hover:ring-white/40'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                  aria-label={`Seleccionar ${color.name}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rims selector — Llantas tab */}
        {activeTab === 'llantas' && (
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl pointer-events-auto hover:bg-[#0a0a0a]/80 transition-colors duration-500">
            <h3 className="text-[10px] font-semibold text-white/50 mb-4 tracking-widest uppercase">Diseño de Llantas</h3>
            <div className="flex flex-wrap gap-3">
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
        )}
      </div>
    </main>
  )
}
