'use client'

import { Suspense, useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS, PRESET_ENVIRONMENTS, PRESET_DECALS, PRESET_VALLEYS, VEHICLES, type VehicleId } from '@/store/useConfiguratorStore'
import Image from 'next/image'
import Wheel from '@uiw/react-color-wheel'
import ShadeSlider from '@uiw/react-color-shade-slider'
import { hexToHsva, hsvaToHex, type HsvaColor } from '@uiw/color-convert'

/* Selector RGB circular: rueda completa de color + brillo + opacidad.
   Controla un hex + un alpha del store del configurador. */
function ColorPickerRGB({
  hex,
  finish,
  onHex,
  onFinish,
  size = 150,
}: {
  hex: string
  finish: number
  onHex: (hex: string) => void
  onFinish: (v: number) => void
  size?: number
}) {
  const [hsva, setHsva] = useState<HsvaColor>(() => ({ ...hexToHsva(hex), a: 1 }))
  return (
    <div className="flex flex-col items-center gap-2.5">
      <Wheel
        color={hsva}
        width={size}
        height={size}
        onChange={(c) => {
          const next = { ...hsva, ...c.hsva, a: 1 }
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
      {/* Acabado: mate (izq) ↔ metálico (der). min-w-0 en el range: sin él su
          min-width intrínseco (~130px) infla la fila y desborda el panel en mobile. */}
      <div className="flex items-center gap-1.5" style={{ width: size + 44 }} title="Acabado: mate ↔ metálico">
        <span className="text-[8px] text-white/40 uppercase tracking-wider shrink-0">Mate</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={finish}
          onChange={(e) => onFinish(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-white cursor-pointer min-w-0"
        />
        <span className="text-[8px] text-white/40 uppercase tracking-wider shrink-0">Metal</span>
      </div>
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

/* Media query reactiva (SSR-safe: arranca en false y se resuelve al montar). */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function Home() {
  const { paintColor, setPaintColor, paintFinish, setPaintFinish, decalColor, setDecalColor, decalFinish, setDecalFinish, interiorTint, setInteriorTint, interiorFinish, setInteriorFinish, rimColor, setRimColor, rimFinish, setRimFinish, valleyColor, setValleyColor, valleyFinish, setValleyFinish, interiorColor, setInteriorColor, environment, setEnvironment, autoRotate, toggleAutoRotate, vehicle, setVehicle } = useConfiguratorStore()
  const { progress } = useProgress()
  const isLoaded = progress >= 100
  const [activeTab, setActiveTab] = useState<null | 'vehiculos' | 'pintura' | 'interior' | 'llantas' | 'luz' | 'cargar' | 'guardar'>(null)
  // Teléfono apaisado (viewport bajo): compacta el bottom bar para no tapar el auto.
  const compact = useMediaQuery('(max-height: 480px)')
  const wheelSize = compact ? 54 : 86
  // Perfiles de color: localStorage = caché instantánea/offline; la fuente
  // robusta es /api/perfiles (nube compartida entre dispositivos). Al montar
  // se mergean por nombre (gana el updatedAt más nuevo y los tombstones de la
  // nube tapan lo borrado) y se sube lo que la nube no tenga.
  type Perfil = { name: string; cfg: { paintColor: string; paintFinish?: number; decalColor: string; decalFinish?: number; interiorTint: string; interiorFinish?: number; rimColor: string; rimFinish?: number; valleyColor: string; valleyFinish?: number; environment: string; vehicle?: string }; updatedAt?: number }
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [nombrePerfil, setNombrePerfil] = useState('')
  // 'cloud' = sincronizado con la nube; 'local' = solo este navegador.
  const [syncEstado, setSyncEstado] = useState<'cloud' | 'local'>('local')
  const persistirLocal = (lista: Perfil[]) => {
    try { localStorage.setItem('gw_perfiles', JSON.stringify(lista)) } catch { /* storage lleno/privado */ }
  }
  useEffect(() => {
    let local: Perfil[] = []
    try { local = JSON.parse(localStorage.getItem('gw_perfiles') || '[]') } catch { /* corrupto */ }
    setPerfiles(local)
    ;(async () => {
      try {
        const res = await fetch('/api/perfiles', { cache: 'no-store' })
        if (!res.ok) return
        const { storage, perfiles: remotos, deleted } = (await res.json()) as { storage: string; perfiles: Perfil[]; deleted: { name: string; deletedAt: number }[] }
        if (storage === 'none') return
        const porNombre = new Map<string, Perfil>()
        for (const p of [...remotos, ...local]) {
          const prev = porNombre.get(p.name)
          if (!prev || (p.updatedAt ?? 0) > (prev.updatedAt ?? 0)) porNombre.set(p.name, p)
        }
        for (const t of deleted ?? []) {
          const p = porNombre.get(t.name)
          if (p && (p.updatedAt ?? 0) <= t.deletedAt) porNombre.delete(t.name)
        }
        const merged = [...porNombre.values()]
        setPerfiles(merged)
        persistirLocal(merged)
        setSyncEstado('cloud')
        // subir lo que la nube no tiene o tiene más viejo (p.ej. guardado offline)
        const remotoAt = new Map(remotos.map((p) => [p.name, p.updatedAt ?? 0]))
        for (const p of merged) {
          if ((remotoAt.get(p.name) ?? -1) < (p.updatedAt ?? 0)) {
            fetch('/api/perfiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => { /* se reintenta en la próxima visita */ })
          }
        }
      } catch { /* sin red: queda la copia local */ }
    })()
  }, [])
  const guardarPerfil = () => {
    const name = nombrePerfil.trim()
    if (!name) return
    const cfg = { paintColor, paintFinish, decalColor, decalFinish, interiorTint, interiorFinish, rimColor, rimFinish, valleyColor, valleyFinish, environment, vehicle }
    const perfil: Perfil = { name, cfg, updatedAt: Date.now() }
    const nuevos = [...perfiles.filter((p) => p.name !== name), perfil]
    setPerfiles(nuevos)
    persistirLocal(nuevos)
    fetch('/api/perfiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(perfil) })
      .then((r) => setSyncEstado(r.ok ? 'cloud' : 'local'))
      .catch(() => setSyncEstado('local'))
    setNombrePerfil('')
    setActiveTab(null)
  }
  const cargarPerfil = (p: Perfil) => {
    setVehicle((p.cfg.vehicle as VehicleId) ?? 'porsche')
    setPaintColor(p.cfg.paintColor); setPaintFinish(p.cfg.paintFinish ?? 0.85)
    setDecalColor(p.cfg.decalColor); setDecalFinish(p.cfg.decalFinish ?? 0)
    setInteriorTint(p.cfg.interiorTint); setInteriorFinish(p.cfg.interiorFinish ?? 0)
    setRimColor(p.cfg.rimColor); setRimFinish(p.cfg.rimFinish ?? 1)
    setValleyColor(p.cfg.valleyColor); setValleyFinish(p.cfg.valleyFinish ?? 0.4)
    setEnvironment(p.cfg.environment as Parameters<typeof setEnvironment>[0])
  }
  const borrarPerfil = (name: string) => {
    if (!window.confirm(`¿Borrar el perfil "${name}"? Queda una copia en la papelera de la nube.`)) return
    const borrado = perfiles.find((p) => p.name === name)
    const nuevos = perfiles.filter((p) => p.name !== name)
    setPerfiles(nuevos)
    persistirLocal(nuevos)
    // papelera local además de la de la nube: borrar nunca destruye datos
    try {
      const trash = JSON.parse(localStorage.getItem('gw_perfiles_trash') || '[]')
      trash.push({ ...borrado, deletedAt: Date.now() })
      localStorage.setItem('gw_perfiles_trash', JSON.stringify(trash))
    } catch { /* sin espacio: la nube guarda su copia igual */ }
    fetch('/api/perfiles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => { /* tombstone pendiente */ })
  }
  // Selección de vehículo: Porsche → carga el perfil "Franco Bitt"; Jaguar →
  // arranca en gris (su config default).
  const seleccionarVehiculo = (id: VehicleId) => {
    setVehicle(id)
    setActiveTab(null) // el nuevo vehículo puede no tener el tab abierto (ej. Titi sin Pintura)
    if (id === 'porsche') {
      const franco = perfiles.find((p) => p.name === 'Franco Bitt')
      if (franco) cargarPerfil(franco)
    } else if (id === 'jaguar') {
      // Jaguar default = blanco con franjas azules + llantas cromo + interior rojo
      setPaintColor('#e9e9e7'); setPaintFinish(0.7)
      setDecalColor('#273f99'); setDecalFinish(0.5)
      setRimColor('#dadada'); setRimFinish(1)
      setInteriorTint('#980a00'); setInteriorFinish(0)
    }
    // 'titi' = Jaguar #3 negro FIJO (materiales horneados) — sin defaults de color
  }

  // Estilos compartidos del bottom bar. Cada tab revela su panel SOLO al pasar el
  // cursor por encima (hover), via group-hover. El `pb-3` del wrapper hace de puente
  // entre el tab y el panel para que no se cierre al mover el cursor hacia arriba.
  const tabBtn = 'px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium tracking-wide text-white/65 group-hover:text-white group-hover:bg-white/10 transition-all duration-300 whitespace-nowrap'
  const popWrap = 'absolute bottom-full left-1/2 -translate-x-1/2 pb-3 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300'
  const popCard = 'bg-[#0a0a0a]/70 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl'
  const popTitle = 'text-[9px] font-semibold text-white/50 mb-2.5 tracking-widest uppercase text-center'
  // w-max + mx-auto: centrado cuando entra, y si desborda el scroll-x arranca
  // en 0 (justify-center con overflow deja la punta izquierda inalcanzable).
  const panelRow = `w-max mx-auto flex items-center ${compact ? 'gap-3 px-1 pt-2' : 'gap-5 px-2 pt-3'} pb-1`
  const dividerCls = `w-px ${compact ? 'h-14' : 'h-20'} bg-white/10 shrink-0`
  const swatchCls = (active: boolean) =>
    `${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full cursor-pointer transition-all duration-300 ${
      active
        ? 'scale-110 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.25)]'
        : 'ring-1 ring-white/10 hover:ring-white/40'
    }`

  // En Cargar mostrar SOLO los perfiles del vehículo activo (los del Porsche no
  // tienen campo vehicle → cuentan como 'porsche'; los del Jaguar lo traen).
  const perfilesVehiculo = perfiles.filter((p) => (p.cfg.vehicle ?? 'porsche') === vehicle)

  return (
    <main
      className="w-screen h-screen text-white overflow-hidden font-sans selection:bg-white/20 relative"
      // 100dvh: en mobile, 100vh queda detrás del chrome del browser y tapa el
      // bottom bar (h-screen es el fallback si el browser no soporta dvh).
      style={{ background: 'radial-gradient(ellipse at top, #3a3c42 0%, #1e2024 40%, #0e0f12 100%)', height: '100dvh' }}
    >
      {/* Loading Screen — usa useProgress de drei para el progreso real del GLB */}
      <LoadingScreen />

      {/* ── GATE DE ORIENTACIÓN ── el configurador está diseñado apaisado: en
          teléfonos verticales este overlay cubre todo y pide girar el
          dispositivo (display lo maneja .rotate-gate en globals.css). */}
      <div
        className="rotate-gate fixed inset-0 z-[70] flex-col items-center justify-center gap-3 text-center px-10"
        style={{ background: 'radial-gradient(ellipse at top, #3a3c42 0%, #1e2024 40%, #0e0f12 100%)' }}
      >
        <Image
          src="/img/logopage.webp"
          alt="Gerstner Werks"
          width={110}
          height={37}
          className="object-contain h-auto w-[110px] opacity-90 mb-8"
        />
        <svg
          className="rotate-gate-icon text-white/70"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="7.5" y="2.5" width="9" height="19" rx="2.2" />
          <line x1="10.2" y1="18.6" x2="13.8" y2="18.6" />
        </svg>
        <p className="text-white/85 text-sm font-medium tracking-wide mt-2">Girá el teléfono</p>
        <p className="text-white/40 text-xs">El configurador se usa en pantalla horizontal</p>
      </div>

      {/* 3D Canvas - siempre detrás, nítido (sin blur de tabs) */}
      <div className={`absolute inset-0 z-0 transition-all duration-[1200ms] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>

      {/* ── HEADER ── logo (izq, más grande/menos sombra) + botón pausar giro (der) */}
      <header className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between ${compact ? 'px-3 pt-2.5' : 'px-3 sm:px-8 pt-4 sm:pt-6'} pb-0 pointer-events-none transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Logo */}
        <div className="pointer-events-auto shrink-0">
          <Image
            src="/img/logopage.webp"
            alt="Gerstner Werks Logo"
            width={180}
            height={60}
            className={`drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] opacity-100 object-contain h-auto ${compact ? 'w-[70px]' : 'w-[100px] sm:w-[158px]'}`}
            priority
          />
        </div>


      </header>

      {/* ── BOTTOM BAR ── la barra ES el menú: al elegir un tab se expande
          horizontalmente con los controles inline (nada tapa el vehículo). */}
      <nav className={`absolute ${compact ? 'bottom-3' : 'bottom-5'} left-0 right-0 z-30 flex justify-center pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pointer-events-none transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={toggleAutoRotate}
          className={`pointer-events-auto shrink-0 self-start ${compact ? 'w-8 h-8' : 'w-10 h-10'} mr-2 rounded-full bg-[#0a0a0a]/75 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300`}
          title={autoRotate ? 'Pausar giro' : 'Reanudar giro'}
          aria-label={autoRotate ? 'Pausar giro' : 'Reanudar giro'}
        >
          {autoRotate ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className={`pointer-events-auto bg-[#0a0a0a]/75 backdrop-blur-2xl border border-white/10 rounded-3xl ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} shadow-2xl max-w-[88vw] overflow-x-auto`}>
          {/* fila de tabs */}
          <div className="w-max mx-auto flex gap-1">
            {([['vehiculos', 'Vehículos'], ['pintura', 'Pintura'], ['interior', 'Interior'], ['llantas', 'Llantas'], ['luz', 'Luz'], ['cargar', 'Cargar']] as const)
              // Titi es fijo (no configurable) → ocultar Pintura/Interior/Llantas
              .filter(([id]) => vehicle !== 'titi' || (id !== 'pintura' && id !== 'interior' && id !== 'llantas'))
              .map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(activeTab === id ? null : id)}
                className={`${compact ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs sm:text-sm'} rounded-full font-medium tracking-wide transition-all duration-300 whitespace-nowrap ${
                  activeTab === id ? 'bg-white text-black' : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* contenido inline del tab activo (horizontal, compacto) */}
          {activeTab === 'vehiculos' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Vehículo</span>
                <div className="flex gap-2">
                  {VEHICLES.map((v) => (
                    <button key={v.id} onClick={() => seleccionarVehiculo(v.id)}
                      className={`${compact ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs'} rounded-full font-medium tracking-wide transition-all duration-300 whitespace-nowrap ${
                        vehicle === v.id ? 'bg-white text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}>
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pintura' && vehicle === 'porsche' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Pintura</span>
                <ColorPickerRGB hex={paintColor} finish={paintFinish} onHex={setPaintColor} onFinish={setPaintFinish} size={wheelSize} />
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_COLORS.map((color) => (
                    <button key={color.id} onClick={() => setPaintColor(color.hex)}
                      className={swatchCls(paintColor === color.hex)}
                      style={{ backgroundColor: color.hex }} title={color.name} aria-label={`Pintura ${color.name}`} />
                  ))}
                </div>
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Adhesivos</span>
                <ColorPickerRGB hex={decalColor} finish={decalFinish} onHex={setDecalColor} onFinish={setDecalFinish} size={wheelSize} />
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_DECALS.map((d) => (
                    <button key={d.id} onClick={() => setDecalColor(d.hex)}
                      className={swatchCls(decalColor === d.hex)}
                      style={{ backgroundColor: d.hex }} title={d.name} aria-label={`Adhesivos ${d.name}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pintura' && vehicle === 'jaguar' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Carrocería</span>
                <ColorPickerRGB hex={paintColor} finish={paintFinish} onHex={setPaintColor} onFinish={setPaintFinish} size={wheelSize} />
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Franjas</span>
                <ColorPickerRGB hex={decalColor} finish={decalFinish} onHex={setDecalColor} onFinish={setDecalFinish} size={wheelSize} />
              </div>
            </div>
          )}

          {activeTab === 'interior' && vehicle === 'jaguar' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Interior (cuero)</span>
                <ColorPickerRGB hex={interiorTint} finish={interiorFinish} onHex={setInteriorTint} onFinish={setInteriorFinish} size={wheelSize} />
              </div>
            </div>
          )}

          {activeTab === 'interior' && vehicle === 'porsche' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Interior</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_INTERIORS.map((interior) => (
                    <button
                      key={interior.id}
                      onClick={() => { setInteriorColor(interior); setInteriorTint(interior.tint) }}
                      className={`${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-full font-medium flex items-center gap-2 transition-all duration-300 whitespace-nowrap ${
                        interiorColor.id === interior.id ? 'bg-white text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: interior.hex }} />
                      {interior.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Tono del cuero</span>
                <ColorPickerRGB hex={interiorTint} finish={interiorFinish} onHex={setInteriorTint} onFinish={setInteriorFinish} size={wheelSize} />
              </div>
            </div>
          )}

          {activeTab === 'llantas' && vehicle === 'jaguar' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Llantas</span>
                <ColorPickerRGB hex={rimColor} finish={rimFinish} onHex={setRimColor} onFinish={setRimFinish} size={wheelSize} />
              </div>
            </div>
          )}

          {activeTab === 'llantas' && vehicle === 'porsche' && (
            <div className={panelRow}>
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Cromado</span>
                <ColorPickerRGB hex={rimColor} finish={rimFinish} onHex={setRimColor} onFinish={setRimFinish} size={wheelSize} />
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_RIMS.map((rim) => (
                    <button key={rim.id} onClick={() => setRimColor(rim.hex)}
                      className={swatchCls(rimColor === rim.hex)}
                      style={{ backgroundColor: rim.hex }} title={rim.name} aria-label={`Llantas ${rim.name}`} />
                  ))}
                </div>
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Valle</span>
                <ColorPickerRGB hex={valleyColor} finish={valleyFinish} onHex={setValleyColor} onFinish={setValleyFinish} size={wheelSize} />
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_VALLEYS.map((v) => (
                    <button key={v.id} onClick={() => setValleyColor(v.hex)}
                      className={swatchCls(valleyColor === v.hex)}
                      style={{ backgroundColor: v.hex }} title={v.name} aria-label={`Valle ${v.name}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guardar' && (
            <div className="flex items-center justify-center gap-2 px-2 pt-3 pb-1">
              <span className={popTitle + ' !mb-0 shrink-0'}>Nombre del perfil</span>
              <input
                autoFocus
                value={nombrePerfil}
                onChange={(e) => setNombrePerfil(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') guardarPerfil() }}
                placeholder="ej: Azul oro clasico"
                className={`bg-white/10 border border-white/15 rounded-full px-4 ${compact ? 'py-1 text-xs w-44' : 'py-1.5 text-sm w-52'} text-white placeholder-white/30 outline-none focus:border-white/40`}
              />
              <button
                onClick={guardarPerfil}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/85 transition-all"
              >
                Guardar
              </button>
            </div>
          )}

          {activeTab === 'cargar' && (
            <div className="flex items-center justify-center gap-2 px-2 pt-3 pb-1 flex-wrap max-w-[600px]">
              {perfilesVehiculo.length === 0 && (
                <span className="text-white/40 text-xs py-1">No hay perfiles guardados — usá el botón 💾 para crear uno.</span>
              )}
              {perfilesVehiculo.map((p) => (
                <span key={p.name} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-2 py-1">
                  <span className="w-4 h-4 rounded-full border border-black/30" style={{ backgroundColor: p.cfg.paintColor }} />
                  <span className="w-4 h-4 rounded-full border border-black/30 -ml-2" style={{ backgroundColor: p.cfg.decalColor }} />
                  <button onClick={() => cargarPerfil(p)} className="text-xs font-medium text-white/80 hover:text-white px-1.5">
                    {p.name}
                  </button>
                  <button onClick={() => borrarPerfil(p.name)} aria-label={`Borrar ${p.name}`}
                    className="text-white/30 hover:text-white text-xs px-0.5">×</button>
                </span>
              ))}
              {perfilesVehiculo.length > 0 && (
                <span
                  className={`text-[9px] pl-1 whitespace-nowrap ${syncEstado === 'cloud' ? 'text-white/25' : 'text-amber-200/60'}`}
                  title={syncEstado === 'cloud' ? 'Perfiles sincronizados en la nube: disponibles desde cualquier dispositivo' : 'Guardados solo en este navegador (nube no disponible)'}
                >
                  {syncEstado === 'cloud' ? '☁ sincronizado' : '⚠ solo este dispositivo'}
                </span>
              )}
            </div>
          )}

          {activeTab === 'luz' && (
            <div className="flex items-center justify-center gap-2 px-2 pt-3 pb-1">
              {PRESET_ENVIRONMENTS.map((env) => (
                <button key={env.id} onClick={() => setEnvironment(env.id)}
                  className={swatchCls(environment === env.id)}
                  style={{ backgroundColor: env.swatch }} title={env.name} aria-label={`Iluminación ${env.name}`} />
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setActiveTab(activeTab === 'guardar' ? null : 'guardar')}
          className={`pointer-events-auto shrink-0 self-start ${compact ? 'w-8 h-8' : 'w-10 h-10'} ml-2 rounded-full backdrop-blur-2xl border border-white/10 flex items-center justify-center transition-all duration-300 ${
            activeTab === 'guardar' ? 'bg-white text-black' : 'bg-[#0a0a0a]/75 text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="Guardar perfil de colores"
          aria-label="Guardar perfil de colores"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z" />
          </svg>
        </button>
      </nav>
    </main>
  )
}
