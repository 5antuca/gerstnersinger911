// Catálogo de colores de FÁBRICA para el buscador de "Pintura" (carrocería).
// Escribís el nombre (ej. "grey black") y aplica el color.
//
// hex afinados con los códigos/colores oficiales (Porsche: L80K Guards Red, M7Z GT
// Silver, M5C Miami Blue…; Jaguar E-Type: 026 Opalescent Dark Green, CDF Signal Red…).
// ⚠️ Siguen siendo APROXIMADOS: un metalizado/opalescente físico no tiene hex canónico,
// y en el render el color pasa por la iluminación (env) + tone mapping AgX, que lo
// desatura/comprime un toque. Ajustá el que no te cierre viéndolo en el auto — es solo
// data, editar acá no toca el render 3D ni los perfiles guardados.

export interface CatalogColor {
  name: string
  hex: string
}

// Porsche — clásicos + modernos más pedidos.
export const PORSCHE_CATALOG: CatalogColor[] = [
  { name: 'Black', hex: '#0b0b0c' },
  { name: 'Jet Black Metallic', hex: '#16171b' },
  { name: 'Grey Black', hex: '#24262b' },
  { name: 'Slate Grey', hex: '#3f434b' },
  { name: 'Agate Grey Metallic', hex: '#34373c' },
  { name: 'Meteor Grey Metallic', hex: '#464a50' },
  { name: 'Vulcano Grey Metallic', hex: '#54565a' },
  { name: 'Quartz Grey Metallic', hex: '#6c7075' },
  { name: 'Crayon', hex: '#9ea09e' },
  { name: 'Chalk', hex: '#c7c5ba' },
  { name: 'GT Silver Metallic', hex: '#b6b9bb' },
  { name: 'Rhodium Silver Metallic', hex: '#a8acb0' },
  { name: 'Dolomite Silver Metallic', hex: '#c3c6c6' },
  { name: 'Carrara White', hex: '#edeeeb' },
  { name: 'Carrara White Metallic', hex: '#e6e8e4' },
  { name: 'White', hex: '#f4f5f3' },
  { name: 'Guards Red', hex: '#e10a17' },
  { name: 'Carmine Red', hex: '#9e0b1a' },
  { name: 'Bordeaux Red Metallic', hex: '#4a1420' },
  { name: 'Racing Yellow', hex: '#f7cb00' },
  { name: 'Speed Yellow', hex: '#f5d400' },
  { name: 'Signal Yellow', hex: '#efc200' },
  { name: 'Miami Blue', hex: '#12b0d4' },
  { name: 'Shark Blue', hex: '#1e86bb' },
  { name: 'Gulf Blue', hex: '#4a86c0' },
  { name: 'Gentian Blue Metallic', hex: '#1e3a6b' },
  { name: 'Sapphire Blue Metallic', hex: '#283a63' },
  { name: 'Night Blue Metallic', hex: '#1a2942' },
  { name: 'Aventurine Green Metallic', hex: '#1d4a3e' },
  { name: 'Racing Green Metallic', hex: '#123a2c' },
  { name: 'Python Green', hex: '#6d7d18' },
  { name: 'Lizard Green', hex: '#46912b' },
  { name: 'Lava Orange', hex: '#e5560f' },
  { name: 'Gulf Orange', hex: '#e07f28' },
]

// Jaguar E-Type — paleta clásica de fábrica.
export const JAGUAR_CATALOG: CatalogColor[] = [
  { name: 'Opalescent Dark Green', hex: '#2a3d31' },
  { name: 'British Racing Green', hex: '#123e26' },
  { name: 'Sherwood Green', hex: '#23443a' },
  { name: 'Willow Green', hex: '#7f8c5d' },
  { name: 'Carmen Red', hex: '#ab1522' },
  { name: 'Signal Red', hex: '#c11f26' },
  { name: 'Regency Red', hex: '#7c1620' },
  { name: 'Opalescent Silver Blue', hex: '#9aa8b4' },
  { name: 'Opalescent Silver Grey', hex: '#a6abae' },
  { name: 'Cotswold Blue', hex: '#4a6a86' },
  { name: 'Indigo Blue', hex: '#26324f' },
  { name: 'Opalescent Golden Sand', hex: '#bfa268' },
  { name: 'Opalescent Gunmetal', hex: '#4b5157' },
  { name: 'Warwick Grey', hex: '#8e9295' },
  { name: 'Mist Grey', hex: '#b7bab8' },
  { name: 'Primrose Yellow', hex: '#edd75a' },
  { name: 'Pale Primrose', hex: '#ecdf8f' },
  { name: 'Old English White', hex: '#eceadd' },
  { name: 'Cream', hex: '#eee6cf' },
  { name: 'Sable', hex: '#382a1e' },
  { name: 'Black', hex: '#0f0f0f' },
]

export function catalogForVehicle(vehicle: string): CatalogColor[] {
  return vehicle === 'jaguar' ? JAGUAR_CATALOG : PORSCHE_CATALOG
}
