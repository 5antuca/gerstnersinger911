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
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader, DRACOLoader, KTX2Loader, GLTF } from 'three-stdlib'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'

const MODEL_URL = '/models/PorscheSinger.glb'
const SCALE = 0.0254 // modelo en pulgadas → metros

// Nombres de material reales del GLB del Singer
const PAINT_MAT = 'Paint_ext'
const RIM_MATS = ['Fuchs_1', 'Fuchs_2', 'Fuchs_cap']
// El piso lo definen las ruedas de calle. Material Tire_base = meshes de
// neumático limpios y separados por rueda. (Tire_extrude/Tire_rough están
// soldados en mega-meshes de la optimización en Max → su bbox es inservible,
// llega a -27in y hacía flotar el auto ~0.6m.)
const FLOOR_MATS = ['Tire_base']

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
  const rigRef = useRef<THREE.Group>(null)
  const paintColor = useConfiguratorStore((s) => s.paintColor)
  const rimStyle = useConfiguratorStore((s) => s.rimStyle)

  // Indexar materiales por nombre (una sola vez)
  const materials = useMemo(() => {
    const map: Record<string, THREE.Material> = {}
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) if (m && m.name) map[m.name] = m
      }
    })
    return map
  }, [scene])

  // Centrar + apoyar el auto en el piso DESPUÉS de montar, con las matrices
  // de mundo ya finales. El piso se define por las RUEDAS (no por el bbox
  // completo) para ignorar planos de sombra horneados u otra geometría que
  // cuelgue por debajo de los neumáticos y haga flotar el auto.
  useLayoutEffect(() => {
    const rig = rigRef.current
    if (!rig) return
    rig.position.set(0, 0, 0)
    rig.updateWorldMatrix(true, true)

    // bbox completo → centrado horizontal (X/Z)
    const full = new THREE.Box3().setFromObject(rig)
    const center = full.getCenter(new THREE.Vector3())

    // Fondo de cada rueda de calle (un valor por mesh Tire_base). Usamos la
    // MEDIANA para ignorar outliers: la rueda de auxilio interna (al centro,
    // más baja) y cualquier mesh raro. Las 4 ruedas de calle están niveladas.
    const wheelBottoms: number[] = []
    rig.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        if (mats.some((m) => m && FLOOR_MATS.includes(m.name))) {
          wheelBottoms.push(new THREE.Box3().setFromObject(o).min.y)
        }
      }
    })
    let floorY = full.min.y // fallback
    if (wheelBottoms.length) {
      wheelBottoms.sort((a, b) => a - b)
      floorY = wheelBottoms[Math.floor(wheelBottoms.length / 2)] // mediana
    }

    rig.position.x = -center.x // centrar en X
    rig.position.y = -floorY // apoyar ruedas sobre y=0
    rig.position.z = -center.z // centrar en Z

    // TEMP debug (sacar al confirmar grounding): leer en consola del navegador
    console.info('[Car] grounding', { floorY, fullMinY: full.min.y, wheels: wheelBottoms.length })
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
      <group ref={rigRef} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
