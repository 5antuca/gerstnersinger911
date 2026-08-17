'use client'

import { Canvas } from '@react-three/fiber'
import {
  Environment,
  OrbitControls,
  ContactShadows,
  PerformanceMonitor,
} from '@react-three/drei'
import { Component, Suspense, useState, type ReactNode } from 'react'
import { Model as Car } from './Car'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three-stdlib'

// Inicializa las LTC textures que necesitan los rectAreaLight (softboxes de estudio
// del Jaguar). Sin esto los rectAreaLight no iluminan. Idempotente.
RectAreaLightUniformsLib.init()

/*
  Barrera de error para el HDRI del entorno.

  Los presets de drei (`city`, `sunset`, `warehouse`…) bajan el archivo de un
  CDN de terceros. Si ese CDN falla, el error sube por el árbol del Canvas y se
  lleva puesta TODA la página. Con esto, un HDRI caído solo degrada la
  iluminación: se usa el forest.hdr local y el configurador sigue andando.

  Tiene que ser un componente de CLASE: es la única forma de capturar errores
  de render en React.
*/
class BarreraEntorno extends Component<
  { children: ReactNode; fallback: ReactNode },
  { fallo: boolean }
> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[entorno] HDRI remoto no disponible, usando el local:', error)
  }
  render() {
    return this.state.fallo ? this.props.fallback : this.props.children
  }
}

/*
  HDRI de cada iluminación, SERVIDOS DESDE EL REPO (public/env).

  Antes se usaba `preset=` de drei, que baja el archivo de un CDN de terceros
  en vivo. El 2026-08-17 ese CDN se cayó (daño colateral de un incidente de
  GitHub) y, como TODOS los presets guardados usan 'city', se cayó el studio
  entero y los links de clientes. Ahora los archivos viven acá: son los mismos
  bytes que servía drei (bajados por jsDelivr, idénticos a los de Poly Haven).
*/
const HDRI: Record<string, string> = {
  city: '/env/potsdamer_platz_1k.hdr',
  studio: '/env/studio_small_03_1k.hdr',
  warehouse: '/env/empty_warehouse_01_1k.hdr',
  sunset: '/env/venice_sunset_1k.hdr',
  forest: '/env/forest_slope_1k.hdr',
  apartment: '/env/lebombo_1k.hdr',
  real: '/env/forest.hdr',
  v5: '/env/sunset_v5.hdr',
}

// Escena model-agnostic. Look calcado del Material Preview de Blender:
// HDRI = forest.exr (el studiolight por defecto de Blender), iluminación SOLO
// por HDRI (sin luces extra), tone mapping Standard (sin Filmic) y fondo gris
// neutro como el viewport. Así la web respeta los colores/reflejos del .blend.
export function Scene() {
  // DPR adaptativo para fluidez en web: arranca en 1.25, baja a 1 si caen FPS.
  const [dpr, setDpr] = useState(1.25)
  // HDRI / iluminación seleccionada por el usuario (preset de drei).
  const environment = useConfiguratorStore((s) => s.environment)
  const autoRotate = useConfiguratorStore((s) => s.autoRotate)
  const vehicle = useConfiguratorStore((s) => s.vehicle)

  return (
    <Canvas
      // Cámara fotográfica: focal larga (fov 18 ≈ tele), poca distorsión.
      camera={{ position: [6.45, 1.54, -7.52], fov: 18 }}
      dpr={dpr}
      gl={{
        antialias: true,
        // Blender usa view transform AgX (default 4.x): desatura + comprime
        // highlights. Lo replicamos con AgXToneMapping → el studio matchea el look
        // de Blender por construcción (con los colores base horneados en el GLB).
        // Ver vault: Pipeline_GLB_Source_of_Truth.
        toneMapping: THREE.AgXToneMapping,
        // Exposición 1.0 = paridad exacta con Blender (GLB v10 autocontenido +
        // mismo forest.hdr @1.0). El +12% era una calibración de la era v9.
        toneMappingExposure: 1.0,
        powerPreference: 'high-performance',
      }}
      onCreated={(state) => {
        // dev-only: expone el estado de R3F en window para calibración de color
        // (mover cámara, leer pipeline, samplear píxeles). NO llega a prod.
        if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
          ;(window as unknown as { __three?: unknown }).__three = state
        }
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(1.5)}
      />

      {/* Fondo: el propio HDRI blureado, en TODAS las iluminaciones (antes solo
          en "real"; el resto tenía un domo gris fijo que no acompañaba). Así el
          fondo toma el color del entorno elegido, como el FONDO_CAMARA del
          .blend. El <color> queda de base para el instante previo a que cargue. */}
      <color attach="background" args={['#131316']} />

      {/* Reflejos de estudio SOLO para el Jaguar (el Porsche queda HDRI puro).
          El forest.hdr es difuso y AgX comprime los reflejos → la pintura metálica
          se veía plana, muy distinta al Material Preview de Blender (que refleja la
          HDRI de ciudad `city.exr`, brillante). Estos rectAreaLight actúan como
          softboxes de estudio: la pintura metálica los refleja como highlights anchos
          y brillantes (glossy, como Blender). Clave: en metal el difuso es ~0, así que
          reflejan SIN correr el color difuso → el match de color del forest se mantiene.
          El directional suma un brillo puntual tipo sol. */}
      {vehicle === 'jaguar' && (
        <>
          <rectAreaLight position={[0, 9, -2]} width={18} height={10} intensity={3} onUpdate={(l) => l.lookAt(0, 0.5, 0)} />
          <rectAreaLight position={[-9, 5, -5]} width={10} height={8} intensity={2.4} onUpdate={(l) => l.lookAt(0, 0.5, 0)} />
          <rectAreaLight position={[9, 5, 5]} width={10} height={8} intensity={2.4} onUpdate={(l) => l.lookAt(0, 0.5, 0)} />
          <directionalLight position={[6, 10, -4]} intensity={1.5} />
        </>
      )}

      <Suspense fallback={null}>
        <Car />

        {/* Sombra de contacto con el piso (el auto está quieto → frames=1). */}
        <ContactShadows
          resolution={1024}
          frames={1}
          scale={16}
          blur={2.4}
          opacity={0.75}
          far={2.2}
          color="#000000"
          position={[0, 0.002, 0]}
        />

        {/* HDRI SOLO para iluminación y reflejos (el fondo sigue gris neutro).
            Preset de drei elegido por el usuario desde el selector "Entorno".
            environmentIntensity 1.0 = strength 1.0 del World.
            key fuerza el remount al cambiar de preset para recargar el HDRI. */}
        {/* HDRI del entorno: ilumina, da los reflejos Y es el fondo blureado.
            Todos los archivos son LOCALES (public/env) — ver el mapa HDRI de
            arriba y por qué se dejó de usar el CDN de drei.
            `key` fuerza el remount al cambiar de opción para recargar el HDRI. */}
        <BarreraEntorno
          key={environment}
          fallback={
            <Environment
              files={HDRI.real}
              environmentIntensity={1.0}
              background
              backgroundBlurriness={0.6}
            />
          }
        >
          <Environment
            files={HDRI[environment] ?? HDRI.real}
            /* v5 replica el studiolight de Blender: más intenso y rotado. */
            environmentIntensity={environment === 'v5' ? 2.0 : 1.0}
            environmentRotation={environment === 'v5' ? [0, -2.559, 0] : [0, 0, 0]}
            background
            /* "real" mantiene su blur suave calibrado contra el .blend; el
               resto va más difuso para que el fondo no compita con el auto. */
            backgroundBlurriness={environment === 'real' ? 0.25 : 0.6}
          />
        </BarreraEntorno>

      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.4}
        autoRotate={autoRotate}
        autoRotateSpeed={0.3}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={2.4}
        maxDistance={16}
        target={[0, 0.55, 0]}
        makeDefault
      />
    </Canvas>
  )
}
