'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import { Model as Car } from './Car'

export function Scene() {
  return (
    <Canvas
      camera={{ position: [4, 1.5, -4], fov: 45 }}
      dpr={[1, 2]} // Support for high-DPI screens
      gl={{ antialias: true, toneMappingExposure: 1.2 }}
    >
      <color attach="background" args={['#050505']} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      <Suspense fallback={null}>
        <Car />

        <ContactShadows 
          resolution={1024} 
          scale={10} 
          blur={2} 
          opacity={0.5} 
          far={5} 
          color="#000000"
        />

        <Environment 
          files="/env/MR_INT-005_WhiteNeons_NAD1K.hdr" 
          background={false}
          blur={0}
        />
      </Suspense>

      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        minPolarAngle={Math.PI / 6} 
        maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera from going below ground
        minDistance={3}
        maxDistance={8}
        target={[0, 0.5, 0]} // Enfocar al centro del auto
        makeDefault
      />
    </Canvas>
  )
}
