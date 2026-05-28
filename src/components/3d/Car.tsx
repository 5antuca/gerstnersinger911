'use client'

/*
  Porsche Singer (modelo propio Gerstner) — loader genérico.
  El modelo viene de 3ds Max en pulgadas y con nombres de material reales
  (Paint_ext, Fuchs_*, Leather_*, etc.). En vez de hardcodear cada mesh
  (gltfjsx), renderizamos la escena entera con <primitive> y overrideamos
  los materiales por nombre. Cambiar de modelo (ej. v5 con fenders smooth)
  = cambiar MODEL_URL y nada más.
*/

import * as THREE from 'three'
import { useLayoutEffect, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader, DRACOLoader, KTX2Loader, GLTF } from 'three-stdlib'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'

const MODEL_URL = '/models/PorscheSinger.glb'
const SCALE = 0.0254 // modelo en pulgadas → metros

// Nombres de material reales del GLB del Singer
const PAINT_MAT = 'Paint_ext'
const RIM_MATS = ['Fuchs_1', 'Fuchs_2', 'Fuchs_cap']

export function Model(props: any) {
  const gl = useThree((state) => state.gl)
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
    loader.setDRACOLoader(dracoLoader)

    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  }) as unknown as GLTF

  const scene = gltf.scene
  const paintColor = useConfiguratorStore((s) => s.paintColor)
  const rimStyle = useConfiguratorStore((s) => s.rimStyle)

  // Indexar materiales por nombre + calcular el offset para centrar y apoyar
  // el auto en el piso (robusto al origen interno del modelo).
  const { materials, offset } = useMemo(() => {
    const map: Record<string, THREE.Material> = {}
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) if (m && m.name) map[m.name] = m
      }
    })
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const off = new THREE.Vector3(
      -center.x * SCALE, // centrar en X
      -box.min.y * SCALE, // apoyar sobre y=0
      -center.z * SCALE, // centrar en Z
    )
    return { materials: map, offset: off }
  }, [scene])

  // Pintura exterior + llantas dinámicas desde el store
  useLayoutEffect(() => {
    const paint = materials[PAINT_MAT] as THREE.MeshStandardMaterial | undefined
    if (paint) paint.color.set(paintColor)

    for (const name of RIM_MATS) {
      const m = materials[name] as THREE.MeshStandardMaterial | undefined
      if (m) {
        m.color.set(rimStyle.hex)
        m.metalness = rimStyle.metalness
        m.roughness = rimStyle.roughness
      }
    }
  }, [paintColor, rimStyle, materials])

  return (
    <group {...props} dispose={null}>
      <group position={offset} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
