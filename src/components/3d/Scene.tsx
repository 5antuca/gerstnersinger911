'use client'

import { Canvas } from '@react-three/fiber'
import {
  Environment,
  OrbitControls,
  ContactShadows,
  PerformanceMonitor,
} from '@react-three/drei'
import { Suspense, useState, useEffect } from 'react'
import { Model as Car } from './Car'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'
import * as THREE from 'three'

// Escena model-agnostic. Look calcado del Material Preview de Blender (HDRI por
// preset de drei, tone mapping AgX, fondo gris neutro).
export function Scene() {
  // DPR adaptativo en desktop: arranca 1.25, baja a 1 si caen FPS.
  const [dpr, setDpr] = useState(1.25)
  // Detección mobile/touch → optimizaciones de performance.
  const [isMobile, setIsMobile] = useState(false)
  const environment = useConfiguratorStore((s) => s.environment)

  useEffect(() => {
    const m =
      typeof window !== 'undefined' &&
      ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        window.innerWidth < 820)
    setIsMobile(!!m)
  }, [])

  return (
    <Canvas
      // Cámara fotográfica: focal larga (fov 18 ≈ tele), poca distorsión.
      camera={{ position: [6.45, 1.54, -7.52], fov: 18 }}
      // Mobile: DPR fijo en 1 (un celu DPR 2-3 renderiza 4-9× los píxeles → mata FPS).
      dpr={isMobile ? 1 : dpr}
      // Mobile: render ON-DEMAND → solo renderiza al interactuar (no quema GPU en
      // idle ni se calienta/throttlea). Desktop: continuo (para autoRotate).
      frameloop={isMobile ? 'demand' : 'always'}
      gl={{
        // AA off en mobile (caro en GPU móvil; a DPR 1 + on-demand no se nota).
        antialias: !isMobile,
        // AgX como el view transform de Blender 4.x.
        toneMapping: THREE.AgXToneMapping,
        powerPreference: 'high-performance',
      }}
    >
      {/* PerformanceMonitor solo en desktop (en mobile el DPR está fijo en 1). */}
      {!isMobile && (
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      )}

      {/* Fondo gris neutro como el viewport de Blender. */}
      <color attach="background" args={['#3c3c3c']} />

      <Suspense fallback={null}>
        <Car />

        {/* Sombra de contacto (auto quieto → frames=1, se hornea una vez).
            Resolución más baja en mobile. */}
        <ContactShadows
          resolution={isMobile ? 512 : 1024}
          frames={1}
          scale={16}
          blur={2.4}
          opacity={0.75}
          far={2.2}
          color="#000000"
          position={[0, 0.002, 0]}
        />

        {/* HDRI solo para iluminación/reflejos. Preset de drei elegido por el usuario. */}
        <Environment
          key={environment}
          preset={environment}
          environmentIntensity={1.0}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.4}
        // autoRotate solo en desktop: en mobile rotaría sin parar = render continuo = lag.
        autoRotate={!isMobile}
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
