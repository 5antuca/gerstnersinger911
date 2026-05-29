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
  { id: 'silver', hex: '#c8ccd0', name: 'Classic Silver', metalness: 0.9, roughness: 0.42 },
  { id: 'black', hex: '#141414', name: 'Anodized Black', metalness: 0.85, roughness: 0.4 },
  { id: 'gold', hex: '#d4af37', name: 'Aurum Gold', metalness: 0.8, roughness: 0.4 },
]

export const PRESET_INTERIORS = [
  { id: 'camel-woven', hex: '#c19a6b', name: 'Camel Woven', image: '/img/interiors/camel-woven.jpg' },
  { id: 'green-woven', hex: '#234a36', name: 'Green Woven', image: '/img/interiors/green-woven.jpg' },
  { id: 'black-houndstooth', hex: '#1a1a1a', name: 'Black Houndstooth', image: '/img/interiors/black-houndstooth.jpg' },
  { id: 'brown-plaid', hex: '#5c3a21', name: 'Brown Plaid', image: '/img/interiors/brown-plaid.jpg' },
]

interface ConfiguratorState {
  paintColor: string;
  setPaintColor: (color: string) => void;
  rimStyle: typeof PRESET_RIMS[0];
  setRimStyle: (rim: typeof PRESET_RIMS[0]) => void;
  interiorColor: typeof PRESET_INTERIORS[0];
  setInteriorColor: (interior: typeof PRESET_INTERIORS[0]) => void;
}

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  paintColor: PRESET_COLORS[0].hex,
  setPaintColor: (color) => set({ paintColor: color }),
  rimStyle: PRESET_RIMS[0],
  setRimStyle: (rim) => set({ rimStyle: rim }),
  interiorColor: PRESET_INTERIORS[0],
  setInteriorColor: (interior) => set({ interiorColor: interior }),
}))
