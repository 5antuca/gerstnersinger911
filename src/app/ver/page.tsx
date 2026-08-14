'use client'

import { Configurador } from '@/components/Configurador'

// VISOR DE CLIENTE — link público (no pide clave). Mismo 3D que el editor:
// se puede rotar, hacer zoom, abrir las puertas y cambiar entre los presets
// guardados, pero no se puede modificar ningún color.
export default function Ver() {
  return <Configurador cliente />
}
