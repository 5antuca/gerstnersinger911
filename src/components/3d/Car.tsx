'use client'

/*
  Porsche Singer (modelo propio Gerstner) — loader del GLB autocontenido.

  PRINCIPIO (ver vault: Pipeline_GLB_Source_of_Truth): el GLB v10 sale del
  pipeline Blender→glTF con TODOS los materiales horneados/autoreados en
  Blender (pintura, lentes de faros, weave, decales, vidrios, metales).
  La web NO parcha materiales por nombre: lo que se ve en Blender es lo que
  se ve acá, porque comparten AgX + el mismo HDRI (forest.hdr).

  Lo ÚNICO dinámico (features del configurador):
  - Pintura (selector de color) → reemplaza Paint_ext por un physical material.
  - Llantas (selector) → recolorea Fuchs_spoke.
  - Color de adhesivos (opcional a futuro) → baseColorFactor de
    Bumper_stripe_mat / Decal_PORSCHE_tex (el "DECAL_COLOR" del .blend).
*/

import * as THREE from 'three'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader, DRACOLoader, KTX2Loader, GLTF } from 'three-stdlib'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'

// v11 = v10 sin las franjas de paragolpes (Bumper_stripe_F/R ocultas a pedido
// en v5/v6/web, 2026-06-12; el material Bumper_stripe_mat se purgó con ellas)
// v12 = v11 + molduras de paragolpes (Front_molding + Rear_molding_L/R, cromo+goma)
// inyectadas con gltf-transform desde v6_gs (2026-06-15)
// v13 = v12 con el rubber de las molduras oscuro (color goma de llanta, material
// Rubber_tire separado) (2026-06-15)
// v14 = v13 con las molduras traseras re-conformadas al cuerpo real del GLB web
// (apoyan flush, ya no flotan) (2026-06-16)
// v15/v16/v17 (vidrios) = intentos de material (OPAQUE / transmission=0) para el
// "vidrio volando" del frente. SIN EFECTO (el user confirmo "exactamente igual";
// pagina servia v17, sin cache) -> el bug del frente es GEOMETRICO, no de material.
// v14 (conform de molduras traseras) deformo/alargo la goma -> el user lo rechazo.
// REVERTIDO a v13 (2026-06-16): molduras como en v6 (sin conformar) + vidrios
// originales. El "vidrio volando" del frente queda para arreglar por geometria.
// v18 = intento de correr el cover -4.5cm (quedo "muy adentro"); descartado.
// v19 = v13 con el LENTE de luz de paragolpes del FRENTE reemplazado por el de v6.
// En v6 es un lente SOLIDO (ambar+transparente en una pieza); en el web (v11) estaba
// PARTIDO (cover transparente separado + ambar hundido) -> el cover "flotaba". Se
// sacaron Plane.079/119/130/131/132 y se inyecto el lente v6 Plane.075/114/123/124/125.
// (2026-06-16)
// v23 (2026-06-16) = FIX REAL de la "linea azul" + vidrio fantasma:
//  - La linea azul a la derecha de las luces NO era el lente que no calza: era Plane.427,
//    un panel Paint_ext SOLO-derecho (sin gemelo izq) que asoma entre el faro y la luz.
//    En v6/EEVEE queda tapado por el lente; en three.js asoma. -> BORRADO (lo cubre Plane.397,
//    no deja hueco). Confirmado por hide-test en el visor.
//  - El "vidrio volando" no era geometria (v6 tiene la MISMA geo): era transmission=1 + BLEND
//    = doble render en three.js. -> las 4 luces (Headlamp/parking/orange/red) a alphaMode
//    OPAQUE conservando transmission (three.js las renderiza 1 sola vez, sin fantasma).
// v24 (2026-06-16) = v23 + molduras traseras 11mm hacia adentro (translacion RIGIDA, cromo
//    intacto). El molding se diseno sobre el cuerpo v6; el cuerpo del GLB web es distinto ->
//    flotaban. Conform/rotacion deformaban el cromo (rechazado); rigido 11mm = lo mas pegado
//    sin deformar (pipeline/fix_moldings.mjs INSET_L=INSET_R=0.011).
// v25/v26 (2026-06-16) = correccion del cap que asomaba en la punta INBOARD de un molding
//    (pegado al overrider central). v25 acorto el lado equivocado; v26 = revertido ese y
//    acortado el correcto (Rear_molding_L) 2cm en su punta de adentro (SHORTEN_L=0.02, escala
//    1D rigida anclada en el extremo de afuera; el otro queda a largo completo). cromo intacto.
const MODEL_URL = '/models/SingerClean-v2.glb'   // Porsche Gerstner v2.0 (= v1 + interior trasero: weave + respaldos + bolsters + ojales; cuero cognac unificado liso=trenzado; barra dash continua). Canonico.
const SCALE = 1.0

const PAINT_MAT = 'Paint_ext'
// Oro de fábrica de los adhesivos (DECAL_COLOR del .blend). Con este valor
// seleccionado NO se pisa el material: se usa el factor horneado del GLB
// (paridad exacta con Blender, igual que hacen las letras PORSCHE_L*).
const DECAL_DEFAULT = '#c5b47a'
// El piso lo definen las ruedas de calle (mediana de los fondos de Tire_base).
const FLOOR_MATS = ['Tire base', 'Tire_base']

// Familia de interior tintable: cuero camel + cuero trenzado (weave) + trims
// caramelo. El tinte es un MULTIPLICADOR sobre el color/textura original
// (blanco = look original del .blend). Excluye los cueros negros (BK).
function esInteriorTintable(nombre: string): boolean {
  const n = nombre.toLowerCase()
  if (n.includes('bk')) return false
  return (
    n.startsWith('pbr_basket_weave') ||
    n.includes('cuero') ||
    n.includes('weave') ||
    n.startsWith('leather_bg') ||
    n.includes('vent_caramel') ||
    n === 'leather_pattern' ||
    n.startsWith('lp_butaca') ||
    // fondo crema del reloj central (tacómetro): acompaña el tono del interior
    n.startsWith('rev meter')
  )
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
  const paintFinish = useConfiguratorStore((s) => s.paintFinish)
  const rimColor = useConfiguratorStore((s) => s.rimColor)
  const valleyColor = useConfiguratorStore((s) => s.valleyColor)
  const decalColor = useConfiguratorStore((s) => s.decalColor)
  const decalFinish = useConfiguratorStore((s) => s.decalFinish)
  const interiorTint = useConfiguratorStore((s) => s.interiorTint)
  const interiorFinish = useConfiguratorStore((s) => s.interiorFinish)
  const rimFinish = useConfiguratorStore((s) => s.rimFinish)
  const valleyFinish = useConfiguratorStore((s) => s.valleyFinish)

  // Pintura dinámica: physical con clearcoat (mismo look que la laca del .blend).
  const paintMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0a1c3a'),
      metalness: 0.85,
      roughness: 0.42,
      clearcoat: 1.0,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1.7,
    })
    m.name = 'Paint_ext_dynamic'
    return m
  }, [])

  const applyToMaterials = useCallback(
    (fn: (m: THREE.MeshStandardMaterial) => void) => {
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) if (m) fn(m as THREE.MeshStandardMaterial)
      })
    },
    [scene]
  )

  // Reemplazar la pintura en todos los meshes que la usan.
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

  // Filtrado de texturas: anisotrópico máximo + trilineal en TODAS, y
  // alpha-to-coverage en los materiales MASK (decales) para que no fantasmeen
  // en ángulos rasantes. Mismo setup que el visor local de referencia.
  useLayoutEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    const seen = new Set<THREE.Texture>()
    const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (!m) continue
        for (const k of keys) {
          const tex = (m as unknown as Record<string, unknown>)[k] as THREE.Texture | null
          if (tex && !seen.has(tex)) {
            seen.add(tex)
            tex.anisotropy = maxAniso
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.generateMipmaps = true
            tex.needsUpdate = true
          }
        }
        if ((m as THREE.Material).alphaTest > 0) {
          ;(m as THREE.Material).alphaToCoverage = true
          ;(m as THREE.Material).needsUpdate = true
        }
      }
    })
  }, [scene, gl])

  // Centrar + apoyar el auto en el piso (piso = mediana de fondos de ruedas).
  useLayoutEffect(() => {
    const rig = rigRef.current
    if (!rig) return
    rig.position.set(0, 0, 0)
    rig.updateWorldMatrix(true, true)

    const full = new THREE.Box3().setFromObject(rig)
    const center = full.getCenter(new THREE.Vector3())

    const wheelBottoms: number[] = []
    rig.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        if (mats.some((m) => m && FLOOR_MATS.includes(m.name))) {
          wheelBottoms.push(new THREE.Box3().setFromObject(o).min.y)
        }
      }
    })
    let floorY = full.min.y
    if (wheelBottoms.length) {
      wheelBottoms.sort((a, b) => a - b)
      floorY = wheelBottoms[Math.floor(wheelBottoms.length / 2)]
    }

    rig.position.x = -center.x
    rig.position.y = -floorY
    rig.position.z = -center.z
  }, [scene])

  // Selectores dinámicos: pintura + llantas + adhesivos.
  useLayoutEffect(() => {
    paintMaterial.color.set(paintColor)
    // mate(0)↔metalico(1), calibrado para que f=0.85 reproduzca EXACTO la
    // pintura flake aprobada (metal .85 / rough .42 / clearcoat 1 / env 1.7).
    // El mate real lo da apagar el CLEARCOAT (la laca): con clearcoat fijo
    // nada se matea por mas que baje metalness.
    paintMaterial.metalness = paintFinish
    paintMaterial.roughness = 0.9 - 0.562 * paintFinish
    paintMaterial.clearcoat = Math.min(1, paintFinish * 1.18)
    paintMaterial.envMapIntensity = 1.0 + 0.82 * paintFinish
    paintMaterial.needsUpdate = true
    applyToMaterials((m) => {
      // Cromados de la llanta: radios+labio (Fuchs_spoke*), centro
      // (Ignition_metal*), bulones y valvula. Matching por PREFIJO: el GLB
      // trae instancias duplicadas con sufijo (.001) que el match exacto perdia.
      {
        const ml = m.name.toLowerCase()
        if (ml.startsWith('fuchs_spoke') || ml.startsWith('ignition_metal') ||
            ml.startsWith('bolt_wheel') || ml.startsWith('valve_metal')) {
          m.color.set(rimColor)
          m.metalness = rimFinish
          // metal(1) = rough .42 (cromo aprobado); mate(0) sube a .78
          m.roughness = 0.78 - 0.36 * rimFinish
          if (ml.startsWith('fuchs_spoke')) m.envMapIntensity = 0.8
          m.needsUpdate = true
        }
        // Valle de la llanta (recovecos): selector propio.
        if (ml.startsWith('fuchs_valley')) {
          m.color.set(valleyColor)
          m.metalness = valleyFinish
          m.roughness = 0.8 - 0.41 * valleyFinish
          m.needsUpdate = true
        }
      }
      // Adhesivos (= node group DECAL_COLOR del .blend): franjas de paragolpes
      // (color sólido directo) + banda lateral (la textura es gris ~0.773: se
      // compensa para que el color final sea el elegido).
      if (m.name === 'Bumper_stripe_mat') {
        if (!m.userData.__origColor) m.userData.__origColor = m.color.clone()
        if (decalColor === DECAL_DEFAULT) m.color.copy(m.userData.__origColor)
        else m.color.set(decalColor)
        m.metalness = decalFinish
        m.roughness = 0.65 - 0.4 * decalFinish
        m.needsUpdate = true
      }
      if (m.name === 'Decal_PORSCHE_tex') {
        if (!m.userData.__origColor) m.userData.__origColor = m.color.clone()
        if (decalColor === DECAL_DEFAULT) {
          m.color.copy(m.userData.__origColor)
        } else {
          // La textura de la banda es gris 197 sRGB = 0.5575 LINEAL, y el
          // shader multiplica factor×texel en LINEAL: compensar con el valor
          // lineal. (El 0.773 sRGB anterior dejaba los claros grises: blanco
          // elegido rendía #dfdfdf.)
          const c = new THREE.Color(decalColor)
          c.multiplyScalar(1 / 0.5575)
          m.color.copy(c)
        }
        m.metalness = decalFinish
        m.roughness = 0.65 - 0.4 * decalFinish
        m.needsUpdate = true
      }
      // Tinte del interior (cuero + trenzado): multiplica el color ORIGINAL
      // del material (guardado en userData la primera vez). Blanco = original.
      if (esInteriorTintable(m.name)) {
        if (!m.userData.__origColor) {
          m.userData.__origColor = m.color.clone()
          m.userData.__origRough = m.roughness
        }
        const orig = m.userData.__origColor as THREE.Color
        const t = new THREE.Color(interiorTint)
        m.color.setRGB(orig.r * t.r, orig.g * t.g, orig.b * t.b)
        // acabado: 0 = original del GLB; 1 = cuero metalizado
        const or = m.userData.__origRough as number
        m.metalness = interiorFinish * 0.9
        m.roughness = or * (1 - interiorFinish) + 0.3 * interiorFinish
        m.needsUpdate = true
      }
    })

    // Letras "PORSCHE" traseras (objetos PORSCHE_L1..L7): siguen el color de
    // los adhesivos. Material CLONADO por letra (Emblem_gold es compartido con
    // otros emblemas que no deben cambiar). Con el color default no se tocan.
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.name.startsWith('PORSCHE_L')) return
      const aplicar = (m: THREE.MeshStandardMaterial) => {
        m.color.set(decalColor)
        m.metalness = Math.max(decalFinish, 0.3)
        m.roughness = 0.65 - 0.4 * decalFinish
        m.needsUpdate = true
      }
      if (!o.userData.__letterMats) {
        if (decalColor === '#c5b47a') return // default: dejar el oro original del GLB
        if (Array.isArray(o.material)) {
          o.material = o.material.map((m) => m.clone())
          o.userData.__letterMats = o.material
        } else {
          o.material = o.material.clone()
          o.userData.__letterMats = [o.material]
        }
      }
      for (const m of o.userData.__letterMats as THREE.MeshStandardMaterial[]) aplicar(m)
    })
  }, [paintColor, paintFinish, rimColor, rimFinish, valleyColor, valleyFinish, decalColor, decalFinish, interiorTint, interiorFinish, applyToMaterials, paintMaterial, scene])

  return (
    <group {...props} dispose={null}>
      <group ref={rigRef} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
