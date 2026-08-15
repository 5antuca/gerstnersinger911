'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProgress } from '@react-three/drei'
import { Scene } from '@/components/3d/Scene'
import { useConfiguratorStore, PRESET_COLORS, PRESET_RIMS, PRESET_INTERIORS, PRESET_ENVIRONMENTS, PRESET_DECALS, PRESET_STRIPES, PRESET_GAUGES, PRESET_VALLEYS, VEHICLES, type VehicleId } from '@/store/useConfiguratorStore'
import Image from 'next/image'
import Wheel from '@uiw/react-color-wheel'
import ShadeSlider from '@uiw/react-color-shade-slider'
import { hexToHsva, hsvaToHex, type HsvaColor } from '@uiw/color-convert'
import { catalogForVehicle, type CatalogColor } from '@/data/paintCatalog'

/* Resuelve un texto a un hex SIN key/nube: acepta un código hex (#a1b2c3 o a1b2c3),
   una forma corta (#abc) o cualquier nombre de color CSS (red, teal, crimson, gold…),
   usando el propio navegador (canvas) para normalizarlo. null si no es válido. */
function resolveColor(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const raw = s.replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return '#' + raw.toLowerCase()
  if (/^[0-9a-fA-F]{3}$/.test(raw)) return '#' + raw.split('').map((c) => c + c).join('').toLowerCase()
  if (typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  // Doble centinela: si el nombre es inválido, fillStyle queda en el centinela (que
  // difiere entre las dos pasadas) → a !== b. Si es válido, ambas resuelven al mismo color.
  ctx.fillStyle = '#010203'; ctx.fillStyle = s; const a = ctx.fillStyle
  ctx.fillStyle = '#040506'; ctx.fillStyle = s; const b = ctx.fillStyle
  if (a !== b) return null
  if (/^#[0-9a-f]{6}$/i.test(a)) return a.toLowerCase()
  const m = a.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (m) return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
  return null
}

/* Buscador de colores (sin key): sugiere del CATÁLOGO (fábrica + famosos), y si
   escribís un #hex o un nombre de color CSS lo aplica igual. El menú se renderiza en
   un PORTAL (document.body) y abre hacia arriba: así NO lo recorta el overflow-x-auto
   del panel (que antes cortaba el dropdown). */
function ColorCatalogSearch({
  catalog,
  onPick,
  compact = false,
}: {
  catalog: CatalogColor[]
  onPick: (hex: string) => void
  compact?: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const query = q.trim()
  const ql = query.toLowerCase()
  const matches = (query ? catalog.filter((c) => c.name.toLowerCase().includes(ql)) : catalog).slice(0, 8)
  const exact = catalog.find((c) => c.name.toLowerCase() === ql)
  const resolved = query && !exact ? resolveColor(query) : null

  // Reposiciona el menú (portal) sobre el input al abrir / al hacer scroll o resize.
  useEffect(() => {
    if (!open) return
    const update = () => setRect(inputRef.current?.getBoundingClientRect() ?? null)
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  const apply = (hex: string, label: string) => { onPick(hex); setQ(label); setOpen(false) }
  const submit = () => {
    if (exact) apply(exact.hex, exact.name)
    else if (matches.length) apply(matches[0].hex, matches[0].name)
    else if (resolved) apply(resolved, query)
  }

  const menu = open && rect ? createPortal(
    <div
      style={{ position: 'fixed', left: rect.left, bottom: window.innerHeight - rect.top + 6, width: Math.max(rect.width, 190), zIndex: 9999 }}
      className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur py-1 shadow-2xl"
    >
      {matches.map((c) => (
        <button
          key={c.name}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); apply(c.hex, c.name) }}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
        >
          <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: c.hex }} />
          <span className="truncate">{c.name}</span>
        </button>
      ))}
      {resolved && !exact && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); apply(resolved, query) }}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs text-white/90 hover:bg-white/10 transition-colors ${matches.length ? 'border-t border-white/10' : ''}`}
        >
          <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: resolved }} />
          <span className="truncate">Aplicar “{query}” <span className="text-white/40">{resolved}</span></span>
        </button>
      )}
      {query && !matches.length && !resolved && (
        <div className="px-2.5 py-2 text-xs text-white/40">Sin resultados</div>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div className={`relative ${compact ? 'w-28' : 'w-36'}`}>
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Color, nombre o #hex…"
        className={`w-full rounded-full bg-white/10 border border-white/15 text-white placeholder-white/40 outline-none focus:border-white/40 ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
      />
      {menu}
    </div>
  )
}

/* Selector RGB circular: rueda completa de color + brillo + opacidad.
   Controla un hex + un alpha del store del configurador. */
function ColorPickerRGB({
  hex,
  finish = 0,
  onHex,
  onFinish,
  size = 150,
  satin = false,
}: {
  hex: string
  finish?: number
  onHex: (hex: string) => void
  // Sin onFinish → se oculta el slider Mate↔Metal (ej. franjas: solo color).
  onFinish?: (v: number) => void
  size?: number
  satin?: boolean
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
      {onFinish && (
      <div className="flex flex-col items-center gap-0.5" style={{ width: size + 44 }} title={satin ? 'Acabado: mate ↔ satín ↔ metálico' : 'Acabado: mate ↔ metálico'}>
        <div className="flex items-center gap-1.5 w-full">
          <span className="text-[8px] text-white/40 uppercase tracking-wider shrink-0">Mate</span>
          <div className="relative flex-1 min-w-0">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={finish}
              onChange={(e) => onFinish(parseFloat(e.target.value))}
              className="w-full h-1 accent-white cursor-pointer"
            />
            {/* tick del satín en el centro (paintFinish 0.5) */}
            {satin && <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-2 bg-white/50" />}
          </div>
          <span className="text-[8px] text-white/40 uppercase tracking-wider shrink-0">Metal</span>
        </div>
        {satin && <span className="text-[7px] text-white/35 uppercase tracking-[0.2em] leading-none">Satín</span>}
      </div>
      )}
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

// Preset con el que arranca el EDITOR. Si no existe (renombrado/borrado), el
// configurador abre en sus colores por defecto sin romper nada.
/* Preset con el que arranca el EDITOR. Se prueban EN ORDEN y gana el primero
   que exista. Va una lista y no un nombre suelto porque el perfil se renombró
   de "Franco Bitt" a "Franco" (2026-08-15) y el nombre viejo hardcodeado dejaba
   al editor SIN preset aplicado: por eso el link copiado salía sin `?p=`.
   Si no existe ninguno, el editor abre en los colores por defecto sin romperse.
   ⚠️ Esto NO afecta el visor de clientes: /ver se guía por el `?p=` del link. */
const PERFILES_INICIALES_EDITOR = ['Franco', 'Franco Bitt']

/*
  El configurador se renderiza en DOS rutas con el mismo 3D:

  - `/`    editor completo (detrás de clave, ver src/proxy.ts)
  - `/ver` visor de cliente (`cliente`), link público para mandar.

  En modo `cliente` la barra inferior NO renderiza la fila de tabs: muestra
  directo la lista de presets. Los paneles de edición solo se montan con
  `activeTab` seteado y en modo cliente nada puede setearlo, así que no existe
  ni el camino para abrirlos (además de que no se renderizan).
*/
export function Configurador({ cliente = false }: { cliente?: boolean } = {}) {
  const { paintColor, setPaintColor, paintFinish, setPaintFinish, decalColor, setDecalColor, decalFinish, setDecalFinish, interiorTint, setInteriorTint, interiorExact, setInteriorExact, interiorFinish, setInteriorFinish, stripeColor, setStripeColor, gaugeColor, setGaugeColor, rimColor, setRimColor, rimFinish, setRimFinish, valleyColor, setValleyColor, valleyFinish, setValleyFinish, interiorColor, setInteriorColor, environment, setEnvironment, autoRotate, toggleAutoRotate, vehicle, setVehicle, jaguarVariant, setJaguarVariant, doorsOpen, toggleDoors, setDoorsOpen } = useConfiguratorStore()
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
  type Perfil = { name: string; cfg: { paintColor: string; paintFinish?: number; decalColor: string; decalFinish?: number; interiorTint: string; interiorExact?: string | null; interiorFinish?: number; stripeColor?: string; gaugeColor?: string; rimColor: string; rimFinish?: number; valleyColor: string; valleyFinish?: number; environment: string; vehicle?: string; jaguarVariant?: string }; updatedAt?: number }
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  // Primero de PERFILES_INICIALES_EDITOR que exista en la lista (o ninguno).
  const perfilInicial = (lista: Perfil[]) =>
    PERFILES_INICIALES_EDITOR.map((n) => lista.find((p) => p.name === n)).find(Boolean)
  const [nombrePerfil, setNombrePerfil] = useState('')
  // 'cloud' = sincronizado con la nube; 'local' = solo este navegador.
  const [syncEstado, setSyncEstado] = useState<'cloud' | 'local'>('local')
  // Último preset aplicado. Sirve para dos cosas: marcar cuál está puesto y
  // que el link para clientes abra en ESE preset.
  const [perfilActivo, setPerfilActivo] = useState<string | null>(null)
  // Feedback del botón Compartir (copia el link /ver al portapapeles).
  const [linkCopiado, setLinkCopiado] = useState(false)
  const copiarLinkCliente = async () => {
    // El link copia lo que estás viendo: el preset aplicado y si las puertas
    // están abiertas. Sin nada de eso va el link pelado (abre en el default).
    const params = new URLSearchParams()
    if (perfilActivo) params.set('p', perfilActivo)
    // Las puertas son del Porsche; con el Jaguar el estado no significa nada.
    if (doorsOpen && vehicle === 'porsche') params.set('puertas', '1')
    const qs = params.toString()
    const url = `${window.location.origin}/ver${qs ? `?${qs}` : ''}`
    let copiado = false
    try {
      await navigator.clipboard.writeText(url)
      copiado = true
    } catch {
      // La Clipboard API se bloquea en http, dentro de iframes o sin permiso.
      // Fallback clásico, que devuelve si de verdad copió.
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { copiado = document.execCommand('copy') } catch { copiado = false }
      document.body.removeChild(ta)
    }
    // Solo confirmar si REALMENTE copió: si no, mostrar el link para copiar a
    // mano en vez de mentir con un "¡copiado!" que deja el portapapeles vacío.
    if (copiado) {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    } else {
      window.prompt('Copiá el link para clientes:', url)
    }
  }
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
        // ⚠️ NUNCA desde el visor de cliente: si no, el localStorage viejo del
        // navegador de un cliente puede reescribir los presets de la nube.
        if (cliente) return
        const remotoAt = new Map(remotos.map((p) => [p.name, p.updatedAt ?? 0]))
        for (const p of merged) {
          if ((remotoAt.get(p.name) ?? -1) < (p.updatedAt ?? 0)) {
            fetch('/api/perfiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => { /* se reintenta en la próxima visita */ })
          }
        }
      } catch { /* sin red: queda la copia local */ }
    })()
  }, [cliente])
  const guardarPerfil = () => {
    const name = nombrePerfil.trim()
    if (!name) return
    const cfg = { paintColor, paintFinish, decalColor, decalFinish, interiorTint, interiorExact, interiorFinish, stripeColor, gaugeColor, rimColor, rimFinish, valleyColor, valleyFinish, environment, vehicle, jaguarVariant }
    const perfil: Perfil = { name, cfg, updatedAt: Date.now() }
    const nuevos = [...perfiles.filter((p) => p.name !== name), perfil]
    setPerfiles(nuevos)
    persistirLocal(nuevos)
    fetch('/api/perfiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(perfil) })
      .then((r) => setSyncEstado(r.ok ? 'cloud' : 'local'))
      .catch(() => setSyncEstado('local'))
    // El recién guardado pasa a ser el activo, y el nombre queda en el form
    // (antes se limpiaba): así el siguiente guardado vuelve a sobreescribir
    // este mismo perfil sin retipear.
    setPerfilActivo(name)
    setNombrePerfil(name)
    setActiveTab(null)
  }
  const cargarPerfil = (p: Perfil) => {
    setVehicle((p.cfg.vehicle as VehicleId) ?? 'porsche')
    setJaguarVariant((p.cfg.jaguarVariant as 'config' | 'titi') ?? 'config')
    setPaintColor(p.cfg.paintColor); setPaintFinish(p.cfg.paintFinish ?? 0.85)
    setDecalColor(p.cfg.decalColor); setDecalFinish(p.cfg.decalFinish ?? 0)
    setInteriorTint(p.cfg.interiorTint)
    // Presets viejos no traen interiorExact -> null -> camino historico intacto.
    setInteriorExact((p.cfg.interiorExact as string | null | undefined) ?? null)
    setInteriorFinish(p.cfg.interiorFinish ?? 0)
    setStripeColor(p.cfg.stripeColor ?? 'off')
    setGaugeColor(p.cfg.gaugeColor ?? 'auto')
    setRimColor(p.cfg.rimColor); setRimFinish(p.cfg.rimFinish ?? 1)
    setValleyColor(p.cfg.valleyColor); setValleyFinish(p.cfg.valleyFinish ?? 0.4)
    // guard: perfiles viejos sin iluminación guardada caerían en undefined y romperían
    // el Environment de la escena → default a 'city' (re-guardá el perfil para fijar la luz).
    setEnvironment((p.cfg.environment as Parameters<typeof setEnvironment>[0]) ?? 'city')
    setPerfilActivo(p.name)
    // Precargar el nombre en el form de guardar: sobreescribir el preset que
    // estás tocando es un Enter. Para crear otro, borrás y escribís uno nuevo.
    setNombrePerfil(p.name)
  }
  /* PRESET DE ARRANQUE. En el visor lo define el link (`?p=<preset>`); en el
     editor, el primero de PERFILES_INICIALES_EDITOR que exista. Se lee de
     window.location y no de useSearchParams para no forzar un Suspense ni sacar
     a /ver del prerender. Espera a que lleguen los presets: entran en dos
     tandas (localStorage primero, nube después), así que mientras no encuentre
     el nombre se vuelve a intentar en cada actualización de la lista. */
  const perfilInicialAplicado = useRef(false)
  useEffect(() => {
    if (perfilInicialAplicado.current || perfiles.length === 0) return
    let p: Perfil | undefined
    if (cliente) {
      const buscado = new URLSearchParams(window.location.search).get('p')
      if (!buscado) { perfilInicialAplicado.current = true; return }
      p = perfiles.find((x) => x.name === buscado)
    } else {
      p = perfilInicial(perfiles)
    }
    if (!p) return // puede estar en la tanda de la nube, que llega después
    cargarPerfil(p)
    perfilInicialAplicado.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, perfiles])

  /* Puertas del link (?puertas=1). Va en su propio efecto y NO espera a los
     presets: un link puede traer puertas sin preset, y así el auto ya abre
     abierto en vez de abrirse un rato después de cargar la lista. */
  const puertasDeUrlAplicado = useRef(false)
  useEffect(() => {
    if (!cliente || puertasDeUrlAplicado.current) return
    puertasDeUrlAplicado.current = true
    if (new URLSearchParams(window.location.search).get('puertas') === '1') setDoorsOpen(true)
  }, [cliente, setDoorsOpen])
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
  // Selección de vehículo: Porsche → carga el preset de arranque; Jaguar →
  // arranca en gris (su config default).
  const seleccionarVehiculo = (id: VehicleId) => {
    setVehicle(id)
    setActiveTab(null)
    if (id === 'porsche') {
      // Misma lista que el arranque: antes tenía "Franco Bitt" suelto y quedó
      // sin efecto al renombrarse el perfil.
      const franco = perfilInicial(perfiles)
      if (franco) cargarPerfil(franco)
    } else if (id === 'jaguar') {
      // Al elegir el Jaguar arranca en el CONFIGURABLE; el preset "Titi" lo pasa a la variante negra.
      setJaguarVariant('config')
      // Jaguar default = blanco con franjas azules + llantas cromo + interior rojo
      setPaintColor('#E7E4DB'); setPaintFinish(0.5)
      setDecalColor('#273f99'); setDecalFinish(0.5)
      setRimColor('#dadada'); setRimFinish(1)
      setInteriorTint('#980a00'); setInteriorExact(null); setInteriorFinish(0)
    }
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
  // El visor de cliente no tiene selector de vehículo, así que lista TODOS los
  // presets: cada uno trae su vehículo y `cargarPerfil` lo cambia al aplicarlo.
  const perfilesVisibles = cliente ? perfiles : perfilesVehiculo
  // ¿El nombre tipeado pisa un perfil que ya existe? Define el texto del botón.
  const sobreescribe = perfiles.some((p) => p.name === nombrePerfil.trim())

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
        {/* Pastillas con texto (no botones redondos de ícono solo): crecen a lo
            ANCHO, que es lo que sobra en apaisado, y no suman altura sobre el
            auto. `whitespace-nowrap` para que la etiqueta no parta en dos
            líneas y engorde la barra. */}
        {(() => {
          const pastilla = `pointer-events-auto shrink-0 self-start mr-2 rounded-full backdrop-blur-2xl border flex items-center gap-1.5 whitespace-nowrap transition-all duration-300 ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-2 text-xs sm:text-sm'
          }`
          return (
            <>
              <button
                onClick={toggleAutoRotate}
                className={`${pastilla} bg-[#0a0a0a]/75 border-white/10 text-white/70 hover:text-white hover:bg-white/10`}
                aria-label={autoRotate ? 'Pausar rotación' : 'Reanudar rotación'}
              >
                {autoRotate ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                <span className="font-medium tracking-wide">{autoRotate ? 'Pausar rotación' : 'Reanudar rotación'}</span>
              </button>
              {/* Puertas del Porsche: abre/cierra (solo Porsche; el Jaguar no tiene). */}
              {vehicle === 'porsche' && (
                <button
                  onClick={toggleDoors}
                  className={`${pastilla} ${
                    doorsOpen
                      ? 'bg-white text-black border-white'
                      : 'bg-[#0a0a0a]/75 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label={doorsOpen ? 'Cerrar puertas' : 'Abrir puertas'}
                >
                  {/* puerta entreabierta: marco + hoja en ángulo */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 21V4h9" />
                    <path d="M13 4l7 3v14" />
                    <path d="M4 21h16" />
                    <circle cx="16.2" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="font-medium tracking-wide">{doorsOpen ? 'Cerrar puertas' : 'Abrir puertas'}</span>
                </button>
              )}
            </>
          )
        })()}
        <div className={`pointer-events-auto bg-[#0a0a0a]/75 backdrop-blur-2xl border border-white/10 rounded-3xl ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} shadow-2xl max-w-[88vw] overflow-x-auto`}>
          {/* fila de tabs — NO se renderiza en modo cliente: es la única puerta
              de entrada a los paneles de edición. */}
          {!cliente && (
          <div className="w-max mx-auto flex gap-1">
            {([['vehiculos', 'Vehículos'], ['pintura', 'Pintura'], ['interior', 'Interior'], ['llantas', 'Llantas'], ['luz', 'Luz'], ['cargar', 'Cargar']] as const)
              // Variante Titi (Jaguar negro fijo) → ocultar Pintura/Interior/Llantas
              .filter(([id]) => !(vehicle === 'jaguar' && jaguarVariant === 'titi') || (id !== 'pintura' && id !== 'interior' && id !== 'llantas'))
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
          )}
          {/* Visor en MOBILE (viewport bajo): una sola pestaña "Presets",
              cerrada por defecto. Ahí la fila envuelta de presets tapaba media
              pantalla; en desktop entra bien y va siempre visible.
              Este botón solo puede setear 'cargar': ningún panel de edición. */}
          {cliente && compact && (
            <div className="w-max mx-auto flex gap-1">
              <button
                onClick={() => setActiveTab(activeTab === 'cargar' ? null : 'cargar')}
                className={`${compact ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs sm:text-sm'} rounded-full font-medium tracking-wide transition-all duration-300 whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'cargar' ? 'bg-white text-black' : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
                aria-expanded={activeTab === 'cargar'}
              >
                Presets
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  className={`transition-transform duration-300 ${activeTab === 'cargar' ? '' : 'rotate-180'}`}
                >
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
            </div>
          )}

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
                <ColorCatalogSearch catalog={catalogForVehicle(vehicle)} onPick={setPaintColor} compact={compact} />
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
                <ColorPickerRGB hex={paintColor} finish={paintFinish} onHex={setPaintColor} onFinish={setPaintFinish} size={wheelSize} satin />
                <ColorCatalogSearch catalog={catalogForVehicle(vehicle)} onPick={setPaintColor} compact={compact} />
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
                      // Los 4 acabados siguen por el camino histórico
                      // (multiplicador): se ven EXACTAMENTE igual que siempre.
                      onClick={() => { setInteriorColor(interior); setInteriorTint(interior.tint); setInteriorExact(null) }}
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
                {/* La rueda aplica el color EXACTO (setInteriorExact). El
                    multiplicador viejo queda solo para los presets ya
                    guardados y los 4 acabados de arriba. */}
                <ColorPickerRGB hex={interiorExact ?? interiorTint} finish={interiorFinish} onHex={setInteriorExact} onFinish={setInteriorFinish} size={wheelSize} />
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Franjas butacas</span>
                {/* Rueda RGB libre (tocarla prende las franjas); sin slider de
                    acabado (las franjas son solo color sobre el tejido). */}
                <ColorPickerRGB hex={stripeColor === 'off' ? '#1e3f78' : stripeColor} onHex={setStripeColor} size={wheelSize} />
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_STRIPES.map((s) => (
                    <button key={s.id} onClick={() => setStripeColor(s.hex)}
                      className={swatchCls(stripeColor === s.hex) + ' relative flex items-center justify-center overflow-hidden'}
                      style={{ backgroundColor: s.hex === 'off' ? '#2b2b2b' : s.hex }}
                      title={s.name} aria-label={`Franjas ${s.name}`}>
                      {s.hex === 'off' && <span className="block w-[140%] h-px bg-white/45 rotate-45" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className={dividerCls} />
              <div className="flex items-center gap-3">
                <span className={popTitle + ' !mb-0 shrink-0'}>Reloj central</span>
                {/* Esfera del tacómetro. 'auto' (esfera original) = swatch con ∅. */}
                <ColorPickerRGB hex={gaugeColor === 'auto' ? '#e8ddc4' : gaugeColor} onHex={setGaugeColor} size={wheelSize} />
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_GAUGES.map((g) => (
                    <button key={g.id} onClick={() => setGaugeColor(g.hex)}
                      className={swatchCls(gaugeColor === g.hex) + ' relative flex items-center justify-center overflow-hidden'}
                      style={{ backgroundColor: g.hex === 'auto' ? '#8a8065' : g.hex }}
                      title={g.name} aria-label={`Reloj ${g.name}`}>
                      {g.hex === 'auto' && <span className="text-[8px] font-bold text-white/80">A</span>}
                    </button>
                  ))}
                </div>
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
                disabled={!nombrePerfil.trim()}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/85 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {/* El nombre viene precargado con el preset abierto, así que
                    conviene decir cuál de las dos cosas va a pasar. */}
                {sobreescribe ? 'Sobreescribir' : 'Guardar nuevo'}
              </button>
            </div>
          )}

          {/* Editor: se abre con el tab "Cargar". Visor: siempre visible en
              desktop, y en mobile detrás de la pestaña "Presets". */}
          {(activeTab === 'cargar' || (cliente && !compact)) && (
            <div className="flex items-center justify-center gap-2 px-2 pt-3 pb-1 flex-wrap max-w-[600px]">
              {perfilesVisibles.length === 0 && (
                <span className="text-white/40 text-xs py-1">
                  {cliente ? 'Todavía no hay modelos para mostrar.' : 'No hay perfiles guardados — usá el botón 💾 para crear uno.'}
                </span>
              )}
              {perfilesVisibles.map((p) => (
                /* grow + basis igual: los chips ESTIRAN para llenar la fila, así
                   no quedan bordes dentados ni huecos raros al abrir el menú.
                   Medido antes del cambio: las filas arrancaban con sangrías
                   distintas (31px vs 19px) y cada chip medía distinto (90–113),
                   así que las columnas no alineaban. El tope evita que una
                   última fila de pocos se estire a lo ancho de todo. */
                <span
                  key={p.name}
                  className={`flex items-center gap-1 rounded-full pl-1.5 pr-2 py-1 border transition-all duration-300 grow basis-[104px] max-w-[168px] ${
                    perfilActivo === p.name ? 'bg-white/15 border-white/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-black/30 shrink-0" style={{ backgroundColor: p.cfg.paintColor }} />
                  <span className="w-4 h-4 rounded-full border border-black/30 -ml-2 shrink-0" style={{ backgroundColor: p.cfg.decalColor }} />
                  <button onClick={() => cargarPerfil(p)} className={`text-xs font-medium px-1.5 min-w-0 flex-1 text-left truncate transition-colors ${perfilActivo === p.name ? 'text-white' : 'text-white/80 hover:text-white'}`} title={p.name}>
                    {p.name}
                  </button>
                  {/* borrar: solo en el editor */}
                  {!cliente && (
                    <button onClick={() => borrarPerfil(p.name)} aria-label={`Borrar ${p.name}`}
                      className="text-white/30 hover:text-white text-xs px-0.5 shrink-0">×</button>
                  )}
                </span>
              ))}
              {!cliente && perfilesVehiculo.length > 0 && (
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
        {/* Guardar + Compartir: solo en el editor. */}
        {!cliente && (
          <>
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
            <button
              onClick={copiarLinkCliente}
              className={`pointer-events-auto shrink-0 self-start ${compact ? 'w-8 h-8' : 'w-10 h-10'} ml-2 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all duration-300 ${
                linkCopiado ? 'bg-white text-black border-white' : 'bg-[#0a0a0a]/75 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
              }`}
              title={
                linkCopiado
                  ? '¡Link copiado!'
                  : perfilActivo
                    ? `Copiar link para clientes — abre en «${perfilActivo}»${doorsOpen && vehicle === 'porsche' ? ' con las puertas abiertas' : ''}`
                    : `Copiar link para clientes${doorsOpen && vehicle === 'porsche' ? ' — con las puertas abiertas' : ' (sin preset: abre en el default)'}`
              }
              aria-label="Copiar link para clientes"
            >
              {linkCopiado ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                /* eslabones de cadena = link */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
                  <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
                </svg>
              )}
            </button>
          </>
        )}
      </nav>
    </main>
  )
}
