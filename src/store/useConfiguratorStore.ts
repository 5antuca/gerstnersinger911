import { create } from 'zustand'

export const PRESET_COLORS = [
  { id: 'night-blue', hex: '#0a1c3a', name: 'Night Blue' },
  { id: 'guards-red', hex: '#dc2626', name: 'Guards Red' },
  { id: 'obsidian-black', hex: '#111111', name: 'Obsidian Black' },
  { id: 'chalk-grey', hex: '#d6d3d1', name: 'Chalk Grey' },
  { id: 'miami-blue', hex: '#0ea5e9', name: 'Miami Blue' },
  { id: 'british-racing-green', hex: '#14532d', name: 'Racing Green' },
]

export const PRESET_RIMS = [
  // color de las CARAS de los radios + el labio/aro exterior. Los VALLES van en
  // negro satinado fijo. Default = aluminio satinado (radios claros + valles
  // negros = look Fuchs Singer de la referencia).
  { id: 'silver', hex: '#e7e7e7', name: 'Satin Silver', metalness: 1, roughness: 0.45 }, // = "Bolt wheel"/alloy EXACTO de Blender (aluminio anodizado, NO oro)
  { id: 'black', hex: '#1b1b1b', name: 'Satin Black', metalness: 0.35, roughness: 0.55 },
  { id: 'gold', hex: '#c9a84a', name: 'Aurum Gold', metalness: 0.75, roughness: 0.5 },
]

export const PRESET_INTERIORS = [
  { id: 'camel-woven', hex: '#c19a6b', name: 'Camel Woven', image: '/img/interiors/camel-woven.jpg' },
  { id: 'green-woven', hex: '#234a36', name: 'Green Woven', image: '/img/interiors/green-woven.jpg' },
  { id: 'black-houndstooth', hex: '#1a1a1a', name: 'Black Houndstooth', image: '/img/interiors/black-houndstooth.jpg' },
  { id: 'brown-plaid', hex: '#5c3a21', name: 'Brown Plaid', image: '/img/interiors/brown-plaid.jpg' },
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
  paintAlpha: number;
  setPaintAlpha: (alpha: number) => void;
  decalColor: string;
  setDecalColor: (color: string) => void;
  decalAlpha: number;
  setDecalAlpha: (alpha: number) => void;
  rimStyle: typeof PRESET_RIMS[0];
  setRimStyle: (rim: typeof PRESET_RIMS[0]) => void;
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
  paintAlpha: 1,
  setPaintAlpha: (alpha) => set({ paintAlpha: alpha }),
  // Dorado actual de los adhesivos (= DECAL_COLOR del .blend en sRGB)
  decalColor: '#c5b47a',
  setDecalColor: (color) => set({ decalColor: color }),
  decalAlpha: 1,
  setDecalAlpha: (alpha) => set({ decalAlpha: alpha }),
  rimStyle: PRESET_RIMS[0],
  setRimStyle: (rim) => set({ rimStyle: rim }),
  interiorColor: PRESET_INTERIORS[0],
  setInteriorColor: (interior) => set({ interiorColor: interior }),
  environment: 'city',
  setEnvironment: (environment) => set({ environment }),
  autoRotate: true,
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
}))
