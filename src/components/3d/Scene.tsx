'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import { Model as Car } from './Car'

export function Scene() {
  return (
    <Canvas
      camera={{ position: [5, 1.8, -5], fov: 33 }}
      dpr={[1, 2]} // Support for high-DPI screens
      gl={{ antialias: true, toneMappingExposure: 1.0 }}
    >
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      {/* Luz de relleno frontal sutil — ilumina la cara del auto que ve la cámara */}
      <directionalLight position={[0, 2, -8]} intensity={0.6} />
      
      <Suspense fallback={null}>
        <Car position={[0, -0.117, 0]} />

        <ContactShadows 
          resolution={1024} 
          scale={10} 
          blur={2} 
          opacity={0.8} 
          far={5} 
          color="#000000"
        />

        <Environment 
          preset="city"
          environmentIntensity={1.2}
          background={false}
          blur={0.8}
        />
      </Suspense>

      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        minPolarAngle={Math.PI / 6} 
        maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera from going below ground
        minDistance={3}
        maxDistance={8}
        target={[0, 0.2, 0]} // Mirar un poco más abajo para subir el auto en pantalla
        makeDefault
      />
    </Canvas>
  )
}
