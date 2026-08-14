import { create } from 'zustand'

export const PRESET_COLORS = [
  { id: 'night-blue', hex: '#0a1c3a', name: 'Night Blue' },
  { id: 'guards-red', hex: '#dc2626', name: 'Guards Red' },
  { id: 'obsidian-black', hex: '#111111', name: 'Obsidian Black' },
  { id: 'chalk-grey', hex: '#d6d3d1', name: 'Chalk Grey' },
  { id: 'miami-blue', hex: '#0ea5e9', name: 'Miami Blue' },
  { id: 'british-racing-green', hex: '#14532d', name: 'Racing Green' },
]

// Colores predeterminados del CROMADO de la llanta (radios + labio + bulones
// + valvula = Fuchs_spoke/Bolt_wheel/Valve_metal). Acabado satinado fijo.
export const PRESET_RIMS = [
  // Gris Franco Bitt = default del configurador (un tono mas oscuro que el satin silver).
  { id: 'gris-franco', hex: '#989898', name: 'Gris' },
  { id: 'silver', hex: '#e7e7e7', name: 'Satin Silver' },
  { id: 'black', hex: '#1b1b1b', name: 'Satin Black' },
  { id: 'gold', hex: '#c9a84a', name: 'Aurum Gold' },
  { id: 'gunmetal', hex: '#5a5a5e', name: 'Gunmetal' },
  { id: 'bronce', hex: '#8a6a4a', name: 'Bronce' },
  { id: 'blanco', hex: '#ececec', name: 'Blanco' },
]

// Tonos del VALLE de la llanta (recovecos Fuchs_valley).
export const PRESET_VALLEYS = [
  { id: 'negro', hex: '#141414', name: 'Negro' },
  { id: 'grafito', hex: '#3a3a3e', name: 'Grafito' },
  { id: 'plata', hex: '#c9c9c9', name: 'Plata' },
  { id: 'oro', hex: '#c9a84a', name: 'Oro' },
  { id: 'bronce', hex: '#8a6a4a', name: 'Bronce' },
  { id: 'blanco', hex: '#ececec', name: 'Blanco' },
]

export const PRESET_INTERIORS = [
  // tint = multiplicador sobre las texturas camel del GLB (blanco = original).
  { id: 'camel-woven', hex: '#c19a6b', tint: '#ffffff', name: 'Camel Woven', image: '/img/interiors/camel-woven.jpg' },
  { id: 'green-woven', hex: '#234a36', tint: '#5a7a5c', name: 'Green Woven', image: '/img/interiors/green-woven.jpg' },
  { id: 'black-houndstooth', hex: '#1a1a1a', tint: '#3f3f42', name: 'Black Houndstooth', image: '/img/interiors/black-houndstooth.jpg' },
  { id: 'brown-plaid', hex: '#5c3a21', tint: '#8a5a3c', name: 'Brown Plaid', image: '/img/interiors/brown-plaid.jpg' },
]

// Franjas del tejido de las BUTACAS (feature web: overlay recoloreable en el
// shader del asiento, no está horneado en el GLB). El primero = "sin franjas"
// (sentinel 'off') = default; el modelo no lleva franjas salvo que se elijan.
export const PRESET_STRIPES = [
  { id: 'off', hex: 'off', name: 'Sin franjas' },
  { id: 'azul', hex: '#1e3f78', name: 'Azul' },
  { id: 'naranja', hex: '#c8641e', name: 'Naranja' },
  { id: 'rojo', hex: '#a52222', name: 'Rojo' },
  { id: 'crema', hex: '#d8c9a0', name: 'Crema' },
  { id: 'verde', hex: '#2f5d3a', name: 'Verde' },
  { id: 'negro', hex: '#141414', name: 'Negro' },
]

// Esfera del RELOJ CENTRAL (tacómetro, material Rev meter.001). 'auto' =
// comportamiento original: la esfera crema acompaña el tinte del interior.
export const PRESET_GAUGES = [
  { id: 'auto', hex: 'auto', name: 'Original' },
  { id: 'crema', hex: '#e8ddc4', name: 'Crema' },
  { id: 'negro', hex: '#1a1a1a', name: 'Negro' },
  { id: 'blanco', hex: '#f2f2f2', name: 'Blanco' },
  { id: 'verde', hex: '#2f5d3a', name: 'Verde' },
  { id: 'bordo', hex: '#6e1f2a', name: 'Bordó' },
]

// Colores predeterminados de los ADHESIVOS (franjas + banda PORSCHE).
// El primero es el oro de fábrica del auto (DECAL_COLOR del .blend).
export const PRESET_DECALS = [
  { id: 'oro-gerstner', hex: '#c5b47a', name: 'Oro Gerstner' },
  { id: 'blanco', hex: '#ffffff', name: 'Blanco' },
  { id: 'negro', hex: '#1c1c1c', name: 'Negro' },
  { id: 'rojo', hex: '#b02020', name: 'Rojo' },
  { id: 'plata', hex: '#cfcfcf', name: 'Plata' },
  { id: 'celeste-gulf', hex: '#7ab5d8', name: 'Celeste Gulf' },
]

// Iluminación / HDRI del entorno. "preset" usa los presets nativos de
// @react-three/drei <Environment preset="..."> (no requiere archivos HDRI
// propios). Default = "warehouse": neutro-cálido, NO lava el auto a blanco como
// "studio". El usuario puede cambiarlo en vivo con el selector ILUMINACIÓN.
export const PRESET_ENVIRONMENTS = [
  // HDRI REAL del .blend de producción (forest.hdr @1.0 + fondo blureado).
  // = lo que se ve en Blender, pixel-parity. DEFAULT del studio.
  { id: 'real', name: 'Real (Blender)', swatch: '#5a6b4f' },
  // HDRI REAL de Blender (sunset.exr @1.618) = matchea la Vista Materiales de v5.
  { id: 'v5', name: 'Materiales v5', swatch: '#e0915a' },
  { id: 'studio', name: 'Studio', swatch: '#cfcfcf' },
  { id: 'warehouse', name: 'Warehouse', swatch: '#8a8478' },
  { id: 'city', name: 'City', swatch: '#9aa7b5' },
  { id: 'sunset', name: 'Sunset', swatch: '#e08a4b' },
  { id: 'forest', name: 'Forest', swatch: '#3f6b45' },
  { id: 'apartment', name: 'Apartment', swatch: '#c4a98a' },
] as const

// Vehículos del configurador. El primero es el default. Cada uno tiene su GLB.
export const VEHICLES = [
  { id: 'porsche', name: 'Porsche Gerstner', glb: '/models/SingerClean-v2.glb' },
  { id: 'jaguar', name: 'Jaguar E-Type', glb: '/models/jaguar.glb?v=5' }, // ?v= = cache-bust: subir el número cada vez que cambia el GLB para forzar bajar el nuevo (evita CDN/browser sirviendo el viejo)
] as const
// El Jaguar E-Type tiene 2 VARIANTES DE MODELO: 'config' (jaguar.glb, configurable)
// y 'titi' (Jaguar #3 negro fijo: faros blancos + piezas traseras escondidas). La
// variante la activa un PRESET ("Titi" en Cargar) vía jaguarVariant — NO es un vehículo
// aparte. Car.tsx carga jaguar-titi.glb cuando vehicle==='jaguar' && jaguarVariant==='titi'.
export const JAGUAR_TITI_GLB = '/models/jaguar-titi.glb?v=3'
export type VehicleId = typeof VEHICLES[number]['id']

// El Jaguar es UN GLB configurable (jaguar.glb). Sus materiales recoloreables:
// Jaguar_Body (principal) + Jaguar_Stripe (franjas/secundario) + Jag1:chrome_rim
// (llantas) + COP:leather1 (interior). La web reusa los campos del Porsche
// (paintColor→body, decalColor→franjas, rimColor→llantas, interiorTint→interior).

export type EnvironmentPreset = typeof PRESET_ENVIRONMENTS[number]['id']

interface ConfiguratorState {
  paintColor: string;
  setPaintColor: (color: string) => void;
  paintFinish: number;
  setPaintFinish: (v: number) => void;
  decalColor: string;
  setDecalColor: (color: string) => void;
  decalFinish: number;
  setDecalFinish: (v: number) => void;
  interiorFinish: number;
  setInteriorFinish: (v: number) => void;
  rimFinish: number;
  setRimFinish: (v: number) => void;
  valleyFinish: number;
  setValleyFinish: (v: number) => void;
  interiorTint: string;
  setInteriorTint: (tint: string) => void;
  // Color EXACTO del interior elegido en la rueda. null = usar interiorTint
  // (multiplicador histórico). Ver el comentario de INTERIOR_REF en Car.tsx.
  interiorExact: string | null;
  setInteriorExact: (hex: string | null) => void;
  // Color de las franjas de las butacas ('off' = sin franjas).
  stripeColor: string;
  setStripeColor: (color: string) => void;
  // Color de la esfera del reloj central ('auto' = original, sigue al interior).
  gaugeColor: string;
  setGaugeColor: (color: string) => void;
  rimColor: string;
  setRimColor: (color: string) => void;
  valleyColor: string;
  setValleyColor: (color: string) => void;
  interiorColor: typeof PRESET_INTERIORS[0];
  setInteriorColor: (interior: typeof PRESET_INTERIORS[0]) => void;
  environment: EnvironmentPreset;
  setEnvironment: (environment: EnvironmentPreset) => void;
  autoRotate: boolean;
  toggleAutoRotate: () => void;
  vehicle: VehicleId;
  setVehicle: (v: VehicleId) => void;
  // Variante de MODELO del Jaguar: 'config' (jaguar.glb configurable) | 'titi' (negro fijo).
  jaguarVariant: 'config' | 'titi';
  setJaguarVariant: (v: 'config' | 'titi') => void;
  // Puertas del Porsche abiertas/cerradas (estado de vista, no se guarda en perfiles).
  doorsOpen: boolean;
  toggleDoors: () => void;
}

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  paintColor: PRESET_COLORS[0].hex,
  setPaintColor: (color) => set({ paintColor: color }),
  // Acabados mate(0)↔metalico(1). Defaults = look actual de cada familia.
  paintFinish: 0.85,
  setPaintFinish: (v) => set({ paintFinish: v }),
  // Dorado actual de los adhesivos (= DECAL_COLOR del .blend en sRGB)
  decalColor: '#c5b47a',
  setDecalColor: (color) => set({ decalColor: color }),
  decalFinish: 0,
  setDecalFinish: (v) => set({ decalFinish: v }),
  interiorFinish: 0,
  setInteriorFinish: (v) => set({ interiorFinish: v }),
  rimFinish: 1,
  setRimFinish: (v) => set({ rimFinish: v }),
  valleyFinish: 0.4,
  setValleyFinish: (v) => set({ valleyFinish: v }),
  // Blanco = texturas camel originales del GLB sin alterar.
  interiorTint: '#ffffff',
  setInteriorTint: (tint) => set({ interiorTint: tint }),
  // null = el interior se resuelve por interiorTint (comportamiento histórico).
  // Los presets viejos NO traen este campo → siguen viéndose igual que siempre.
  interiorExact: null,
  setInteriorExact: (hex) => set({ interiorExact: hex }),
  // 'off' = butacas sin franjas (default). Elegir un color las prende.
  stripeColor: 'off',
  setStripeColor: (color) => set({ stripeColor: color }),
  // 'auto' = esfera original (acompaña el tinte del interior).
  gaugeColor: 'auto',
  setGaugeColor: (color) => set({ gaugeColor: color }),
  rimColor: PRESET_RIMS[0].hex,
  setRimColor: (color) => set({ rimColor: color }),
  valleyColor: PRESET_VALLEYS[0].hex,
  setValleyColor: (color) => set({ valleyColor: color }),
  interiorColor: PRESET_INTERIORS[0],
  setInteriorColor: (interior) => set({ interiorColor: interior }),
  environment: 'city',
  setEnvironment: (environment) => set({ environment }),
  autoRotate: true,
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  vehicle: 'porsche',
  setVehicle: (vehicle) => set({ vehicle }),
  jaguarVariant: 'config',
  setJaguarVariant: (jaguarVariant) => set({ jaguarVariant }),
  doorsOpen: false,
  toggleDoors: () => set((s) => ({ doorsOpen: !s.doorsOpen })),
}))

// Handle de DESARROLLO para inspeccionar/manejar el configurador desde la
// consola (igual que window.__carScene en Car.tsx). No llega a producción.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  ;(window as unknown as { __cfgStore?: unknown }).__cfgStore = useConfiguratorStore
}
