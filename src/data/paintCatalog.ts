// Catálogo de colores de FÁBRICA para el buscador de "Pintura" (carrocería).
// Escribís el nombre (ej. "grey black") y aplica el color.
//
// ⚠️ Los hex son APROXIMADOS: los colores reales son pinturas físicas con reflejos,
// metalizados, etc. — no tienen un hex canónico. Ajustá los que no te cierren
// (y sumá los que falten). Es solo data: editar acá no toca el render 3D.

export interface CatalogColor {
  name: string
  hex: string
}

// Porsche — colores clásicos + modernos más pedidos.
export const PORSCHE_CATALOG: CatalogColor[] = [
  { name: 'Black', hex: '#131313' },
  { name: 'Jet Black Metallic', hex: '#17181a' },
  { name: 'Grey Black', hex: '#2a2b2e' },
  { name: 'Slate Grey', hex: '#464b52' },
  { name: 'Agate Grey Metallic', hex: '#383b40' },
  { name: 'Meteor Grey Metallic', hex: '#4a4f56' },
  { name: 'Vulcano Grey Metallic', hex: '#55585c' },
  { name: 'Quartz Grey Metallic', hex: '#6a6f75' },
  { name: 'Crayon', hex: '#9ea1a3' },
  { name: 'Chalk', hex: '#c9c7be' },
  { name: 'GT Silver Metallic', hex: '#b9bcbe' },
  { name: 'Rhodium Silver Metallic', hex: '#a7abae' },
  { name: 'Dolomite Silver Metallic', hex: '#c2c5c6' },
  { name: 'Carrara White', hex: '#edefec' },
  { name: 'Carrara White Metallic', hex: '#e6e8e5' },
  { name: 'White', hex: '#f3f4f2' },
  { name: 'Guards Red', hex: '#cc1a24' },
  { name: 'Carmine Red', hex: '#a20f1b' },
  { name: 'Bordeaux Red Metallic', hex: '#4e1620' },
  { name: 'Racing Yellow', hex: '#f7c500' },
  { name: 'Speed Yellow', hex: '#f6d500' },
  { name: 'Signal Yellow', hex: '#f0c400' },
  { name: 'Miami Blue', hex: '#14a7c9' },
  { name: 'Shark Blue', hex: '#1f7fb0' },
  { name: 'Gulf Blue', hex: '#4a7fb5' },
  { name: 'Gentian Blue Metallic', hex: '#1f3560' },
  { name: 'Sapphire Blue Metallic', hex: '#29365a' },
  { name: 'Night Blue Metallic', hex: '#1b2740' },
  { name: 'Aventurine Green Metallic', hex: '#1f463b' },
  { name: 'Racing Green Metallic', hex: '#143a2e' },
  { name: 'Python Green', hex: '#6b7a1a' },
  { name: 'Lizard Green', hex: '#4c8a2e' },
  { name: 'Lava Orange', hex: '#e35c14' },
  { name: 'Gulf Orange', hex: '#e08029' },
]

// Jaguar E-Type — paleta clásica de fábrica.
export const JAGUAR_CATALOG: CatalogColor[] = [
  { name: 'Opalescent Dark Green', hex: '#26382c' },
  { name: 'British Racing Green', hex: '#14432a' },
  { name: 'Sherwood Green', hex: '#24433a' },
  { name: 'Willow Green', hex: '#7f8c5d' },
  { name: 'Carmen Red', hex: '#a5141f' },
  { name: 'Signal Red', hex: '#bc1f26' },
  { name: 'Regency Red', hex: '#7a1620' },
  { name: 'Opalescent Silver Blue', hex: '#93a3b0' },
  { name: 'Opalescent Silver Grey', hex: '#a6abae' },
  { name: 'Cotswold Blue', hex: '#4a6a86' },
  { name: 'Indigo Blue', hex: '#26324f' },
  { name: 'Opalescent Golden Sand', hex: '#b89b63' },
  { name: 'Opalescent Gunmetal', hex: '#4b5157' },
  { name: 'Warwick Grey', hex: '#8e9295' },
  { name: 'Mist Grey', hex: '#b7bab8' },
  { name: 'Primrose Yellow', hex: '#ecd657' },
  { name: 'Pale Primrose', hex: '#ecdf8f' },
  { name: 'Old English White', hex: '#ece9dd' },
  { name: 'Cream', hex: '#eee6cf' },
  { name: 'Sable', hex: '#382a1e' },
  { name: 'Black', hex: '#121212' },
]

export function catalogForVehicle(vehicle: string): CatalogColor[] {
  return vehicle === 'jaguar' ? JAGUAR_CATALOG : PORSCHE_CATALOG
}
