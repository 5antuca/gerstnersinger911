'use client'

import { Configurador } from '@/components/Configurador'

// Editor completo. El acceso lo controla src/middleware.ts (clave); el link
// que se le pasa a los clientes es /ver, que monta el mismo 3D sin edición.
export default function Home() {
  return <Configurador />
}
