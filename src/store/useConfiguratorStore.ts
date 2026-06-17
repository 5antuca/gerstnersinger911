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
}))
