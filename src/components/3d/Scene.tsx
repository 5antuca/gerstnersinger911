'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import { Model as Car } from './Car'
import * as THREE from 'three'

export function Scene() {
  return (
    <Canvas
      camera={{ position: [5, 1.8, -5], fov: 33 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.6,
      }}
    >
      {/* Luz ambiente más fuerte para elevar el tono base */}
      <ambientLight intensity={1.2} />

      {/* Luz key desde arriba-derecha (simula softbox de estudio) */}
      <directionalLight position={[8, 10, 4]} intensity={0.8} />

      {/* Luz de relleno frontal — ilumina la cara del auto hacia la cámara */}
      <directionalLight position={[0, 3, -10]} intensity={0.9} />

      {/* Luz de contorno suave desde la izquierda */}
      <directionalLight position={[-6, 4, 2]} intensity={0.4} />

      <Suspense fallback={null}>
        <Car position={[0, -0.117, 0]} />

        <ContactShadows
          resolution={1024}
          scale={10}
          blur={1.5}
          opacity={0.7}
          far={5}
          color="#000000"
        />

        {/* Environment sin blur → reflections nítidos como en la referencia */}
        <Environment
          preset="city"
          environmentIntensity={1.3}
          background={false}
          blur={0}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={3}
        maxDistance={8}
        target={[0, 0.2, 0]}
        makeDefault
      />
    </Canvas>
  )
}
