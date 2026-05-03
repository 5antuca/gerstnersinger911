'use client'

import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS } from '@/store/useConfiguratorStore'
import Image from 'next/image'

export default function Home() {
  const { paintColor, setPaintColor, rimStyle, setRimStyle, interiorColor, setInteriorColor } = useConfiguratorStore()

  return (
    <main className="w-screen h-screen bg-[#050505] text-white flex overflow-hidden font-sans selection:bg-white/20">
      


      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
        
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

          {/* Interior Selector */}
          <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-2xl pointer-events-auto hover:bg-[#0a0a0a]/80 transition-colors duration-500 flex-1 max-w-sm">
            <h3 className="text-sm font-semibold text-white/60 mb-4 tracking-wider uppercase text-[10px]">Acabados del Interior</h3>
            <div className="flex flex-wrap gap-3">
              {PRESET_INTERIORS.map((interior) => (
                <button
                  key={interior.id}
                  onClick={() => setInteriorColor(interior.hex)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 flex items-center gap-2 ${
                    interiorColor === interior.hex 
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105' 
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: interior.hex }}></span>
                  {interior.name}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </main>
  )
}
