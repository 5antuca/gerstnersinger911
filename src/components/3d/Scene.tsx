'use client'

import { Canvas } from '@react-three/fiber'
import {
  Environment,
  OrbitControls,
  ContactShadows,
  PerformanceMonitor,
  GradientTexture,
} from '@react-three/drei'
import { Suspense, useState } from 'react'
import { Model as Car } from './Car'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'
import * as THREE from 'three'

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

      {/* Fondo: con el entorno "real" el fondo es el propio forest.hdr blureado
          (igual que el setup FONDO_CAMARA del .blend). Para el resto de los
          presets se mantiene el domo gris con degradé. */}
      <color attach="background" args={['#131316']} />
      {environment !== 'real' && (
        <mesh scale={60} renderOrder={-1}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial side={THREE.BackSide} depthWrite={false} toneMapped={false}>
            <GradientTexture stops={[0, 0.5, 1]} colors={['#0e0e11', '#2c2d33', '#121216']} size={1024} />
          </meshBasicMaterial>
        </mesh>
      )}

      {/* Luces de estudio SOLO para el Jaguar: el resto de la escena es HDRI puro
          (match Blender). Pero la pintura satinada del Jaguar necesita una fuente
          especular DEFINIDA — el forest.hdr es difuso (sin highlight brillante) y
          AgX comprime los reflejos, así que sin esto la carrocería se ve plana/mate
          por más que se baje la rugosidad. Key + fill desde lados opuestos para que
          el highlight barra la carrocería al rotar. El Porsche se deja como estaba. */}
      {vehicle === 'jaguar' && (
        <>
          <directionalLight position={[6, 10, -4]} intensity={2.5} />
          <directionalLight position={[-7, 8, 6]} intensity={1.6} />
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
        {environment === 'real' ? (
          /* forest.hdr REAL del .blend de producción, strength 1.0, y de fondo el
             mismo HDRI blureado (= FONDO_CAMARA del World de Blender). */
          <Environment
            key="real"
            files="/env/forest.hdr"
            environmentIntensity={1.0}
            background
            backgroundBlurriness={0.25}
          />
        ) : environment === 'v5' ? (
          /* HDRI sunset.exr REAL de Blender → matchea la Vista Materiales de v5
             (misma intensidad 1.618 + rotación que el studiolight). */
          <Environment
            key="v5"
            files="/env/sunset_v5.hdr"
            environmentIntensity={2.0}
            environmentRotation={[0, -2.559, 0]}
          />
        ) : (
          <Environment
            key={environment}
            preset={environment as Exclude<typeof environment, 'v5' | 'real'>}
            environmentIntensity={1.0}
          />
        )}
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
