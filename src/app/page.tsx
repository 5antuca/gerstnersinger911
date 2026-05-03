'use client'

import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS } from '@/store/useConfiguratorStore'
import Image from 'next/image'

export default function Home() {
  const { paintColor, setPaintColor, rimStyle, setRimStyle, interiorColor, setInteriorColor } = useConfiguratorStore()

  return (
    <main 
      className="w-screen h-screen text-white overflow-y-auto overflow-x-hidden font-sans selection:bg-white/20 snap-y snap-mandatory"
      style={{ background: 'radial-gradient(ellipse at top, #565963 0%, #2e3138 40%, #181a1f 100%)' }}
    >
      


      {/* SECTION 1: 3D EXTERIOR */}
      <section className="relative w-full h-screen snap-start shrink-0 flex flex-col">
        
        {/* Header - Glassmorphism */}
        <header className="absolute top-0 left-0 right-0 p-6 z-20 pointer-events-none flex justify-between items-start">
          <div>
            <Image 
              src="/img/logopage.webp" 
              alt="Gerstner Werks Logo" 
              width={150} 
              height={50} 
              className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] opacity-95 object-contain"
              priority
            />
          </div>
        </header>

        {/* 3D Canvas wrapper */}
        <div className="absolute inset-0 z-0">
          <Scene />
        </div>

        {/* Bottom Controls / Stats - Glassmorphism */}
        <div className="absolute bottom-8 left-8 right-8 z-20 pointer-events-none flex gap-6">
          
          {/* Paint Selector */}
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl pointer-events-auto hover:bg-[#0a0a0a]/80 transition-colors duration-500 flex-1 max-w-sm">
            <h3 className="text-sm font-semibold text-white/60 mb-4 tracking-wider uppercase text-[10px]">Pintura Exterior</h3>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setPaintColor(color.hex)}
                  className={`w-10 h-10 rounded-full cursor-pointer transition-all duration-300 ${
                    paintColor === color.hex 
                      ? 'border-2 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                      : 'border-2 border-white/10 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                  aria-label={`Seleccionar ${color.name}`}
                />
              ))}
            </div>
          </div>

          {/* Rims Selector */}
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl pointer-events-auto hover:bg-[#0a0a0a]/80 transition-colors duration-500 flex-1 max-w-sm">
            <h3 className="text-sm font-semibold text-white/60 mb-4 tracking-wider uppercase text-[10px]">Diseño de Llantas</h3>
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

        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-12 right-12 z-20 flex flex-col items-center gap-2 animate-bounce opacity-70 pointer-events-none hidden md:flex">
          <span className="text-xs uppercase tracking-[0.2em]">Interior</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/80 to-transparent"></div>
        </div>

      </section>

      {/* SECTION 2: 2D INTERIOR */}
      <section className="relative w-full h-screen snap-start shrink-0 bg-[#0a0a0a] overflow-hidden">
        
        {/* Crossfade Images */}
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          {PRESET_INTERIORS.map((interior) => (
            <Image
              key={interior.id}
              src={interior.image}
              alt={interior.name}
              fill
              className={`object-cover transition-opacity duration-1000 ease-in-out ${
                interiorColor.id === interior.id ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
              priority
            />
          ))}
          {/* Vignette Overlay */}
          <div className="absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(0,0,0,0.8)_100%)]"></div>
        </div>

        {/* Interior Selector */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-full p-2 shadow-2xl flex gap-2">
            {PRESET_INTERIORS.map((interior) => (
              <button
                key={interior.id}
                onClick={() => setInteriorColor(interior)}
                className={`px-6 py-3 rounded-full text-sm font-semibold cursor-pointer transition-all duration-500 flex items-center gap-3 ${
                  interiorColor.id === interior.id 
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-100' 
                    : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white scale-95'
                }`}
              >
                <span className="w-4 h-4 rounded-full shadow-inner border border-black/20" style={{ backgroundColor: interior.hex }}></span>
                {interior.name}
              </button>
            ))}
          </div>
        </div>

      </section>
    </main>
  )
}
