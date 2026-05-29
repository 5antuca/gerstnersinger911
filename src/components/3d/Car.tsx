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

// Materiales metálicos. El GLB los exportó todos con metalness=0 (SketchUp no
// autorea PBR) → se veían claros y planos. Acá les damos metalness real y un
// roughness por tipo (cromo casi espejo, aluminio satinado, escape matt).
// color opcional = neutralizar tintes placeholder obviamente mal autoreados.
const METAL_MATS: Record<string, { metalness: number; roughness: number; color?: string }> = {
  // cromados / espejo
  Chrome: { metalness: 1, roughness: 0.08, color: '#eaeaea' },
  Mirror: { metalness: 1, roughness: 0.05, color: '#e8e8e8' },
  Fuel_oil_caps: { metalness: 1, roughness: 0.18 },
  // aluminio / acero satinado
  Alu_ext: { metalness: 1, roughness: 0.3 },
  Alu_int: { metalness: 1, roughness: 0.35 },
  Metal_ext_rough: { metalness: 1, roughness: 0.35 },
  Wiper_metal: { metalness: 1, roughness: 0.35 },
  Bolt_wheel: { metalness: 1, roughness: 0.3 },
  Brake_disc: { metalness: 1, roughness: 0.35 },
  Valve_metal: { metalness: 1, roughness: 0.3 },
  Momo_silver: { metalness: 1, roughness: 0.3 },
  Momo_bolts: { metalness: 1, roughness: 0.4 },
  Momo_black_metal: { metalness: 1, roughness: 0.4 },
  Speaker_mesh: { metalness: 1, roughness: 0.5 },
  Footwell_plate: { metalness: 1, roughness: 0.4 },
  // oro (emblemas)
  Emblem_gold: { metalness: 1, roughness: 0.2 },
  Emblem_gold_bump: { metalness: 1, roughness: 0.3 },
  Emblem_gold_normal: { metalness: 1, roughness: 0.3 },
  // escape mate
  Exhaust_matt: { metalness: 1, roughness: 0.55 },
}

// Acabado de materiales NO metálicos (no necesita UV ni texturas): solo
// roughness para que cuero/alfombra/plástico dejen de verse como plástico
// brillante. El color de cada uno se ajusta después contra las fotos de ref.
const FINISH_MATS: Record<string, number> = {
  Leather_BK_rough: 0.72,
  Leather_BR_rough: 0.72,
  Leather_BG_rough: 0.72,
  Leather_BK_glossy: 0.42,
  Leather_BR_glossy: 0.42,
  Carpet_in: 0.95,
  Plastic_int_matt: 0.85,
  Plastic_button_matt: 0.8,
  Momo_leather: 0.7,
  Momo_rubber: 0.9,
  Int_glossy: 0.14, // piano black brilloso
  Pedal_top: 0.6,
  Seatbelt: 0.85,
}

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

  // Pintura propia: MeshPhysicalMaterial con clearcoat → refleja el environment
  // como pintura de auto. Reemplaza al Paint_ext original, que venía sin
  // clearcoat (plano, sin reflejo) y con una baseColorTexture horneada que
  // apagaba el color elegido. Sin map → el color del selector se ve puro.
  const paintMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0a1c3a'),
      metalness: 0.0, // pintura sólida (no metálica) → reflejos blancos del clearcoat
      roughness: 0.42, // base semi-mate; el brillo lo da el clearcoat
      clearcoat: 1.0, // capa transparente reflectante (laca)
      clearcoatRoughness: 0.06, // laca casi espejo → reflejos nítidos
      envMapIntensity: 1.25,
    })
    m.name = 'Paint_ext_dynamic'
    return m
  }, [])

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

  // Reemplazar el material de pintura en todos los meshes que lo usan
  // (incluye meshes multi-material: se reemplaza solo el slot Paint_ext).
  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m) => (m && m.name === PAINT_MAT ? paintMaterial : m))
      } else if (o.material && o.material.name === PAINT_MAT) {
        o.material = paintMaterial
      }
    })
  }, [scene, paintMaterial])

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
  }, [scene])

  // Color de pintura + llantas dinámicas desde el store
  useLayoutEffect(() => {
    paintMaterial.color.set(paintColor)

    for (const name of RIM_MATS) {
      const m = materials[name] as THREE.MeshStandardMaterial | undefined
      if (m) {
        m.color.set(rimStyle.hex)
        m.metalness = rimStyle.metalness
        m.roughness = rimStyle.roughness
      }
    }
  }, [paintColor, rimStyle, materials, paintMaterial])

  // Convertir los materiales metálicos a PBR real (una vez, al cargar).
  useLayoutEffect(() => {
    for (const [name, cfg] of Object.entries(METAL_MATS)) {
      const m = materials[name] as THREE.MeshStandardMaterial | undefined
      if (!m) continue
      m.metalness = cfg.metalness
      m.roughness = cfg.roughness
      if (cfg.color) m.color.set(cfg.color)
      m.envMapIntensity = 1.3 // reflejos del environment más presentes
    }
    // Acabado mate de cuero/alfombra/plástico (no metales)
    for (const [name, roughness] of Object.entries(FINISH_MATS)) {
      const m = materials[name] as THREE.MeshStandardMaterial | undefined
      if (m) m.roughness = roughness
    }
  }, [materials])

  return (
    <group {...props} dispose={null}>
      <group ref={rigRef} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
