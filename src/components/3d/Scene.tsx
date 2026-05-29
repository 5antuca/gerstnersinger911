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
        toneMappingExposure: 1.0,
      }}
    >
      {/* Luz ambiente suave: el GLB nuevo trae PBR real, no hace falta forzar el tono */}
      <ambientLight intensity={0.5} />

      {/* Luz key desde arriba-derecha (simula softbox de estudio) */}
      <directionalLight position={[8, 10, 4]} intensity={0.6} />

      {/* Luz de relleno frontal — ilumina la cara del auto hacia la cámara */}
      <directionalLight position={[0, 3, -10]} intensity={0.5} />

      {/* Luz de contorno suave desde la izquierda */}
      <directionalLight position={[-6, 4, 2]} intensity={0.3} />

      <Suspense fallback={null}>
        <Car />

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
          environmentIntensity={0.65}
          background={false}
          blur={0}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        // Inercia/damping → controles suaves y pesados como la referencia Porsche
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.45}
        // Rotación ociosa muy lenta (se reanuda al soltar el mouse)
        autoRotate
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={3}
        maxDistance={8}
        target={[0, 0.45, 0]}
        makeDefault
      />
    </Canvas>
  )
}
