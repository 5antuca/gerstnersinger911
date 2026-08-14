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
import { useConfiguratorStore, VEHICLES, JAGUAR_TITI_GLB } from '@/store/useConfiguratorStore'

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
  // GLB según el vehículo seleccionado (Porsche / Jaguar). useLoader resuspende
  // al cambiar la URL y carga el otro modelo.
  const vehicle = useConfiguratorStore((s) => s.vehicle)
  const jaguarVariant = useConfiguratorStore((s) => s.jaguarVariant)
  // El Jaguar tiene 2 modelos: configurable (jaguar.glb) y Titi negro (jaguar-titi.glb).
  const baseUrl = VEHICLES.find((v) => v.id === vehicle)?.glb ?? MODEL_URL
  const modelUrl = vehicle === 'jaguar' && jaguarVariant === 'titi' ? JAGUAR_TITI_GLB : baseUrl
  const gltf = useLoader(GLTFLoader, modelUrl, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
    loader.setDRACOLoader(dracoLoader)

    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  }) as unknown as GLTF

  const scene = gltf.scene
  // Handle de diagnóstico (como window.SC del visor crudo): permite inspeccionar
  // materiales/uniforms en vivo desde la consola sin rebuild. Inofensivo en prod.
  if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__carScene = scene
  const rigRef = useRef<THREE.Group>(null)
  const paintColor = useConfiguratorStore((s) => s.paintColor)
  const paintFinish = useConfiguratorStore((s) => s.paintFinish)
  const rimColor = useConfiguratorStore((s) => s.rimColor)
  const valleyColor = useConfiguratorStore((s) => s.valleyColor)
  const decalColor = useConfiguratorStore((s) => s.decalColor)
  const decalFinish = useConfiguratorStore((s) => s.decalFinish)
  const interiorTint = useConfiguratorStore((s) => s.interiorTint)
  const interiorFinish = useConfiguratorStore((s) => s.interiorFinish)
  const stripeColor = useConfiguratorStore((s) => s.stripeColor)
  const doorsOpen = useConfiguratorStore((s) => s.doorsOpen)
  const rimFinish = useConfiguratorStore((s) => s.rimFinish)
  const valleyFinish = useConfiguratorStore((s) => s.valleyFinish)

  // Estado de las franjas de butaca, leído por el onBeforeCompile al compilar.
  const stripeColorRef = useRef(new THREE.Color('#1e3f78'))
  const stripeOnRef = useRef(0)

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

  // PUERTAS del Porsche (feature web, v2 "hasta el paso 2"): cada puerta son
  // piezas SUELTAS del GLB agrupadas bajo un pivot en la bisagra real (borde
  // delantero, eje vertical) con attach(); abrir = rotar el pivot. Viajan la
  // chapa, panel trenzado, cuero, vidrio/marco/burlete, decal + el herraje
  // interior (guanteras, parlantes, espejo, manijas, tornillos Torus).
  // ⚠️ SIN cirugía de mallas fusionadas (splitPorPuerta se eliminó a pedido,
  // 2026-08-13: partía la banda PORSCHE/tiras de tornillos y causaba glitches
  // del adhesivo). Trade-off aceptado: la banda del zócalo y esas tiras
  // quedan quietas al abrir. La solución de fondo es estructurar las puertas
  // en Blender (bisagras + parenting + separar mallas) y exportar GLB nuevo.
  useLayoutEffect(() => {
    if (vehicle !== 'porsche') return
    if (scene.getObjectByName('door_pivot_R')) return // ya armado (useLoader cachea la escena)
    // Piezas grandes conocidas (el vidrio sobresale del corte en z; la regla
    // de volumen lo excluiría — por eso van explícitas).
    // Circle125/Circle346 = marco/sello perimetral de cada puerta (grandes →
    // el filtro de volumen los excluiría; el user los marcó con ?marcar=1:
    // "Circle125 tiene que moverse junto con la puerta", 2026-08-14).
    const DOOR_R = ['Plane171', 'Plane408', 'Cube006', 'Cube038', 'Plane001', 'Plane032', 'Plane142', 'PORSCHE_decal_door_R', 'Circle125']
    const DOOR_L = ['Plane002', 'Plane416', 'Cube083', 'Cube087', 'Plane003', 'Plane413', 'Plane414', 'PORSCHE_decal_door_L', 'Circle346']
    const explicit = new Set([...DOOR_R, ...DOOR_L])
    const extraR: THREE.Object3D[] = []
    const extraL: THREE.Object3D[] = []
    // Herrajes por VOLUMEN, con el centro en MUNDO (localToWorld): en los
    // meshes multi-parte (parlantes, espejo, correas) la posición vive en el
    // nodo PADRE y un test local los deja afuera. Tope z ≤ 0.34: excluye el
    // cluster del tablero (z ≥ 0.36) y las bisagras (z ≈ 0.57, fijas al
    // cuerpo como en el auto real).
    const V = new THREE.Vector3()
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.geometry || explicit.has(o.name)) return
      const geo = o.geometry as THREE.BufferGeometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const b = geo.boundingBox as THREE.Box3
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z
      if (sx > 0.35 || sy > 0.6 || sz > 1.3) return // grandes = carrocería
      V.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
      o.localToWorld(V)
      const ax = Math.abs(V.x)
      // ⚠️ SIN regla especial para los "Torus" a |x|<0.58: esos anillos son los
      // OJALES DE LAS BUTACAS (y 0.35-0.55 = altura almohadón/bolster), no
      // tornillos de puerta — arrastrarlos los hacía levitar (2026-08-13).
      // Los tornillos reales del panel viven a |x|≥0.58 y entran por la regla
      // general de abajo.
      if (ax < 0.58 || ax > 0.9) return // 0.9: la manija derecha llega a |x|~0.87
      if (V.y < 0.2 || V.y > 1.15) return
      if (V.z < -0.6 || V.z > 0.34) return
      ;(V.x > 0 ? extraR : extraL).push(o)
    })
    // BANDA PORSCHE del zócalo (PORSCHE_decal_tex): una malla recorre todo el
    // lateral → su tramo sobre cada hoja debe VIAJAR con la puerta (pedido
    // 2026-08-14: "el del lado del acompañante sigue flotando"). Se parte por
    // TRIÁNGULO con centroide en MUNDO; |x|>0.7 toma SOLO la piel exterior
    // (0.77–0.84) y deja las caras internas del cascarón en la carrocería
    // (moverlas era el "adhesivo bugueado"). Las partes heredan el transform.
    // ⚠️ Las tiras Plane163/Bolt NO se parten: el user marcó con ?marcar=1
    // que no deben moverse.
    const band = scene.getObjectByName('PORSCHE_decal_tex') as THREE.Mesh | undefined
    if (band && band.geometry && band.geometry.index) {
      band.updateWorldMatrix(true, false)
      const bpos = band.geometry.attributes.position
      const bidx = band.geometry.index.array
      const cW = new THREE.Vector3()
      const iBody: number[] = [], iR: number[] = [], iL: number[] = []
      for (let i = 0; i < bidx.length; i += 3) {
        const a = bidx[i], b2 = bidx[i + 1], c2 = bidx[i + 2]
        cW.set(
          (bpos.getX(a) + bpos.getX(b2) + bpos.getX(c2)) / 3,
          (bpos.getY(a) + bpos.getY(b2) + bpos.getY(c2)) / 3,
          (bpos.getZ(a) + bpos.getZ(b2) + bpos.getZ(c2)) / 3
        ).applyMatrix4(band.matrixWorld)
        const enPuertaZ = cW.z > -0.56 && cW.z < 0.61
        const axx = Math.abs(cW.x)
        if (enPuertaZ && axx > 0.7) {
          // piel exterior de la hoja → viaja con su puerta
          if (cW.x > 0) iR.push(a, b2, c2)
          else iL.push(a, b2, c2)
        } else if (enPuertaZ && axx > 0.45) {
          // pliegue INTERNO del cascarón bajo la puerta: ni viaja (atraviesa la
          // carrocería al girar) ni queda (se ve flotando expuesto al abrir) →
          // se ELIMINA del render ("los adhesivos siguen bugueados", 2026-08-14)
        } else {
          iBody.push(a, b2, c2)
        }
      }
      if (iR.length || iL.length) {
        const mkParte = (indices: number[], name: string) => {
          const g = new THREE.BufferGeometry()
          for (const k of Object.keys(band.geometry.attributes)) g.setAttribute(k, band.geometry.attributes[k])
          g.setIndex(indices)
          const parte = new THREE.Mesh(g, band.material)
          parte.name = name
          parte.applyMatrix4(band.matrixWorld) // heredar transform de la fuente
          scene.add(parte)
          return parte
        }
        if (iR.length) extraR.push(mkParte(iR, 'PORSCHE_band_door_R'))
        if (iL.length) extraL.push(mkParte(iL, 'PORSCHE_band_door_L'))
        band.geometry.setIndex(iBody)
      }
    }

    // COMPLETAR POR SIMETRÍA: si una pieza quedó capturada de un lado y su
    // gemela espejada (x→−x) no (nombres/marcos asimétricos), se suma sola.
    const centerOf = (o: THREE.Object3D) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox as THREE.Box3
      const v = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
      o.localToWorld(v)
      return v
    }
    const explicitR = DOOR_R.map((n) => scene.getObjectByName(n)).filter(Boolean) as THREE.Object3D[]
    const explicitL = DOOR_L.map((n) => scene.getObjectByName(n)).filter(Boolean) as THREE.Object3D[]
    const attached = new Set<THREE.Object3D>([...explicitR, ...explicitL, ...extraR, ...extraL])
    const candidatos: { o: THREE.Mesh; c: THREE.Vector3 }[] = []
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.geometry || attached.has(o)) return
      const g = o.geometry as THREE.BufferGeometry
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox as THREE.Box3
      if (b.max.x - b.min.x > 0.35 || b.max.y - b.min.y > 0.6 || b.max.z - b.min.z > 1.3) return
      candidatos.push({ o, c: centerOf(o) })
    })
    const completar = (desde: THREE.Object3D[], hacia: THREE.Object3D[]) => {
      for (const o of desde) {
        if (!(o as THREE.Mesh).geometry) continue // grupos multi-parte: sin bbox propio
        const c = centerOf(o)
        for (const cand of candidatos) {
          if (attached.has(cand.o)) continue
          if (Math.abs(cand.c.x + c.x) < 0.04 && Math.abs(cand.c.y - c.y) < 0.04 && Math.abs(cand.c.z - c.z) < 0.04) {
            hacia.push(cand.o)
            attached.add(cand.o)
          }
        }
      }
    }
    completar([...explicitL, ...extraL], extraR)
    completar([...explicitR, ...extraR], extraL)

    const mk = (name: string, hx: number, hz: number, parts: string[], extras: THREE.Object3D[]) => {
      const g = new THREE.Group()
      g.name = name
      g.position.set(hx, 0.6, hz)
      scene.add(g)
      for (const p of parts) {
        const o = scene.getObjectByName(p)
        if (o) g.attach(o)
      }
      for (const o of extras) g.attach(o)
    }
    mk('door_pivot_R', 0.68, 0.6, DOOR_R, extraR)
    mk('door_pivot_L', -0.68, 0.6, DOOR_L, extraL)
  }, [scene, vehicle])

  // Abrir/cerrar: rotación pura del pivot (sin animación, instantáneo).
  useLayoutEffect(() => {
    const a = doorsOpen ? 0.9 : 0 // ~52°
    const r = scene.getObjectByName('door_pivot_R')
    const l = scene.getObjectByName('door_pivot_L')
    if (r) r.rotation.y = -a // derecha: borde trasero gira hacia +x (afuera)
    if (l) l.rotation.y = a
  }, [doorsOpen, scene, vehicle])

  // MODO MARCADOR (?marcar=1 en la URL): doble clic sobre una pieza → se pinta
  // MAGENTA y su nombre se suma a una lista copiable en pantalla. Para que el
  // user señale exactamente qué piezas corregir (ej. cuáles deben viajar con
  // la puerta) sin describirlas. Doble clic de nuevo la desmarca.
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !window.location.search.includes('marcar')) return
    const el = gl.domElement as HTMLCanvasElement & { __marcadorOn?: boolean }
    if (el.__marcadorOn) return // evitar listeners duplicados por re-mounts
    el.__marcadorOn = true
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const marked = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    let panel = document.getElementById('marcador-piezas') as HTMLDivElement | null
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'marcador-piezas'
      panel.style.cssText =
        'position:fixed;top:12px;left:12px;z-index:99999;background:rgba(0,0,0,.85);color:#fff;font:12px monospace;padding:10px 12px;border-radius:10px;max-width:300px;pointer-events:auto'
      panel.innerHTML =
        '<b>🎯 Marcador de piezas</b><br/>Doble clic sobre una pieza para marcarla (magenta).<div id="mp-list" style="margin-top:6px;white-space:pre-wrap;color:#f6f"></div><button id="mp-copy" style="margin-top:6px;padding:3px 10px;border-radius:6px;background:#fff;color:#000;cursor:pointer">Copiar lista</button><span id="mp-ok" style="margin-left:6px"></span>'
      document.body.appendChild(panel)
      const btn = document.getElementById('mp-copy') as HTMLButtonElement
      btn.onclick = () => {
        const t = (document.getElementById('mp-list') as HTMLDivElement).innerText
        navigator.clipboard?.writeText(t)
        const ok = document.getElementById('mp-ok') as HTMLSpanElement
        ok.textContent = '✓ copiado'
        window.setTimeout(() => (ok.textContent = ''), 1500)
      }
    }
    const onDbl = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(scene.children, true)
      const hit = hits.find((h) => (h.object as THREE.Mesh).isMesh)
      if (!hit) return
      const mesh = hit.object as THREE.Mesh
      if (marked.has(mesh)) {
        mesh.material = marked.get(mesh)!
        marked.delete(mesh)
      } else {
        marked.set(mesh, mesh.material)
        mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff })
      }
      const list = document.getElementById('mp-list') as HTMLDivElement
      list.innerText = [...marked.keys()]
        .map((m) => m.name + (hit.object === m && hit.instanceId != null ? ' [inst ' + hit.instanceId + ']' : ''))
        .join('\n')
    }
    el.addEventListener('dblclick', onDbl)
    return () => el.removeEventListener('dblclick', onDbl)
  }, [scene, gl, camera])

  // FRANJAS del tejido (feature web). Un PAR de franjas finas verticales por
  // pieza (mock Canva del user, 2026-08-12): butacas delanteras + paneles de
  // puerta + traseros (respaldos y almohadón). Quedan DEBAJO del logo RECARO
  // y los ojales porque esos son mallas aparte encima del tejido. El material
  // compartido `PBR_Basket_Weave_001` se CLONA por-mesh (el dash y los demás
  // no se rayan) y el clon sigue empezando con "pbr_basket_weave" → conserva
  // el interiorTint en la base. Posiciones en METROS locales de cada malla
  // (medidas del GLB SingerClean-v2); ejes locales: butacas z = ancho del
  // asiento; puertas z = largo del auto; traseros x = ancho del auto.
  useLayoutEffect(() => {
    const HW = 0.017 // semi-ancho de cada franja (m) → franja ~3.4cm
    const PAIR = 0.04 // separación entre los centros del par (m) → luz ~0.6cm
    const pair = (mid: number) => [mid - PAIR / 2, mid + PAIR / 2]
    // Corrimiento del par hacia AFUERA (lado puerta), espejado izq/der: derecha
    // de la butaca derecha / izquierda de la izquierda, igual en los traseros
    // (foto Singer de referencia del user, 2026-08-12).
    // Offsets asimétricos a propósito: compensan la diferencia de geometría
    // entre las dos butacas para que el par quede a la MISMA distancia del
    // borde en ambas (calibrado a ojo por el user, 2026-08-12).
    const SEAT_OUTBOARD = 0.055 // butaca acompañante (der; m desde el centro del asiento)
    const SEAT_OUTBOARD_L = 0.07 // butaca conductor (izq)
    const REAR_OUTBOARD = 0.06 // respaldos + almohadón traseros
    // GLTFLoader saca los puntos de los nombres: 'Cube.006' → 'Cube006'.
    const TARGETS: { test: RegExp; axis: 'x' | 'y' | 'z'; centers: (bb: THREE.Box3, mesh: THREE.Mesh) => number[] }[] = [
      // Butacas delanteras: par corrido hacia afuera. Medido en vivo: en AMBAS
      // butacas el +z local apunta a −x mundo → "afuera" = −z en la butaca
      // derecha (world x>0) y +z en la izquierda. El lado se decide por la
      // posición MUNDIAL del mesh (robusto ante renombres del export).
      {
        test: /^butaca_fina/, axis: 'z',
        centers: (bb, mesh) => {
          mesh.updateWorldMatrix(true, false)
          const wx = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).x
          // derecha (acompañante): −z afuera, offset pleno; izquierda
          // (conductor): +z afuera, offset 2cm menor (pedido 2026-08-12).
          return pair((bb.min.z + bb.max.z) / 2 + (wx > 0 ? -SEAT_OUTBOARD : SEAT_OUTBOARD_L))
        },
      },
      // Puertas: par vertical hacia el FRENTE de la puerta (mock 2; corrido
      // +4cm y luego +2cm más adelante a pedido, 2026-08-12). Mismo punto
      // longitudinal del auto en ambas (world z≈+0.18, restada la translation).
      { test: /^Cube006/, axis: 'z', centers: () => pair(0.18 - 0.1383) },
      { test: /^Cube083/, axis: 'z', centers: () => pair(0.18 - 0.0125) },
      // Traseros: respaldos (x mundo horneado: derecho mid 0.28 → afuera es
      // +x; izquierdo mid −0.29 → afuera es −x) + almohadón (una malla que
      // cubre ambos lados → un par por lado, alineado con los respaldos ya
      // corridos).
      { test: /^RESPALDO_editar001/, axis: 'x', centers: (bb) => pair((bb.min.x + bb.max.x) / 2 - REAR_OUTBOARD) },
      { test: /^RESPALDO_editar/, axis: 'x', centers: (bb) => pair((bb.min.x + bb.max.x) / 2 + REAR_OUTBOARD) },
      { test: /^Plane167/, axis: 'x', centers: () => [...pair(-0.29 - REAR_OUTBOARD), ...pair(0.28 + REAR_OUTBOARD)] },
    ]

    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const tgt = TARGETS.find((t) => t.test.test(o.name))
      if (!tgt) return
      const geo = o.geometry as THREE.BufferGeometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const centers = tgt.centers(geo.boundingBox as THREE.Box3, o)
      const cvec = new THREE.Vector4(
        centers[0] ?? 1e9, centers[1] ?? 1e9, centers[2] ?? 1e9, centers[3] ?? 1e9
      )

      const cloneWeave = (m: THREE.Material | null): THREE.Material | null => {
        if (!m || !/^pbr_basket_weave/i.test(m.name)) return m
        if ((m as THREE.Material).userData?.__isSeatStripe) return m
        const c = (m as THREE.MeshStandardMaterial).clone()
        c.name = m.name + '_seatstripe'
        c.userData = { __isSeatStripe: true } // limpio → el interiorTint re-cachea __origColor fresco
        c.customProgramCacheKey = () => 'seatstripe_' + c.uuid
        c.onBeforeCompile = (shader) => {
          shader.uniforms.uStripeColor = { value: stripeColorRef.current.clone() }
          shader.uniforms.uStripeOn = { value: stripeOnRef.current }
          shader.uniforms.uStripeCenters = { value: cvec }
          shader.uniforms.uStripeHW = { value: HW }
          shader.vertexShader =
            'varying float vStripeU;\n' +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\n  vStripeU = position.' + tgt.axis + ';'
            )
          shader.fragmentShader =
            'varying float vStripeU;\nuniform vec3 uStripeColor;\nuniform float uStripeOn;\nuniform vec4 uStripeCenters;\nuniform float uStripeHW;\n' +
            shader.fragmentShader.replace(
              '#include <map_fragment>',
              '#include <map_fragment>\n' +
                '  {\n' +
                '    float sm = 0.0;\n' +
                '    for (int i = 0; i < 4; i++) {\n' +
                '      sm = max(sm, 1.0 - smoothstep(uStripeHW * 0.55, uStripeHW, abs(vStripeU - uStripeCenters[i])));\n' +
                '    }\n' +
                // Trenzado: la franja no es continua — colorea cuadradito por
                // medio (damero) siguiendo la trama REAL del tejido. La textura
                // weave_dashmatch tiene 8×10 cuadraditos por tile (medido por
                // DFT + visual), y el damero va en el MISMO espacio UV que el
                // map → cada cuadrado coloreado cae sobre una hebra real.
                '    #ifdef USE_MAP\n' +
                '    float wcheck = mod(floor(vMapUv.x * 8.0) + floor(vMapUv.y * 10.0), 2.0);\n' +
                '    sm *= wcheck;\n' +
                '    #endif\n' +
                '    diffuseColor.rgb = mix(diffuseColor.rgb, uStripeColor, sm * uStripeOn);\n' +
                '  }'
            )
          c.userData.stripeShader = shader
        }
        c.needsUpdate = true
        return c
      }

      if (Array.isArray(o.material)) o.material = o.material.map(cloneWeave) as THREE.Material[]
      else o.material = cloneWeave(o.material) as THREE.Material
    })
  }, [scene])

  // Empujar el color/on-off de las franjas a los shaders ya compilados (y a los
  // refs que lee el onBeforeCompile en la primera compilación).
  useLayoutEffect(() => {
    const on = stripeColor && stripeColor !== 'off' ? 1 : 0
    stripeOnRef.current = on
    if (on) stripeColorRef.current.set(stripeColor)
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        const sh = m && (m as THREE.Material).userData?.stripeShader
        if (sh) {
          sh.uniforms.uStripeOn.value = on
          if (on) sh.uniforms.uStripeColor.value.set(stripeColor)
        }
      }
    })
  }, [stripeColor, scene])

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
      // FAROS de TODOS los Jaguar (config + Titi): three.js renderiza el vidrio/transmisión
      // más plano que el path-tracer de Blender. Estos ajustes corren para CUALQUIER variante
      // (no solo el recolor del config) → recuperan la profundidad del faro como en Blender:
      // domo con reflejo+espesor, reflector visible (no lavado), cromo sutil (no espejo reventado).
      if (vehicle === 'jaguar') {
        const hn = m.name.toLowerCase()
        if (hn.startsWith('headlight_yellow')) {
          m.metalness = 0; m.emissiveIntensity = 0.55; m.roughness = 0.4; m.needsUpdate = true
        } else if (hn.startsWith('light_glass') && (m as unknown as THREE.MeshPhysicalMaterial).transmission > 0) {
          const pm = m as unknown as THREE.MeshPhysicalMaterial
          pm.thickness = 0.6; pm.envMapIntensity = 2.5; pm.roughness = 0.0; pm.needsUpdate = true
        } else if (hn.startsWith('chrome_trim')) {
          m.envMapIntensity = 0.5; m.roughness = 0.2; m.needsUpdate = true
        } else if (hn === 'light.001') {
          m.metalness = 0; m.roughness = 0.5; m.needsUpdate = true
        }
      }
      // CARROCERÍA del Titi (variante negra fija). El material body1 trae un clearcoat
      // casi-espejo (Coat Roughness 0.01) horneado del .blend. En three.js un reflejo tan
      // filoso muestrea el env PMREM (tope ~256px de three) → sobre el negro reflectivo se
      // ven BLOQUES/facetas ("decimado/comprimido/arrugado"). Blender lo path-tracea a
      // full-res y se ve liso; el config (más claro) lo disimula, el Titi negro lo expone
      // (y eso que tiene MÁS polígonos que el config → no es geometría, es el reflejo).
      // Fix: subir la rugosidad del clearcoat → muestrea mips borrosos → liso, sin perder
      // el brillo satinado. La base (rough 0.41) ya difumina bien; solo el coat era filoso.
      if (vehicle === 'jaguar' && jaguarVariant === 'titi') {
        if (m.name.toLowerCase().startsWith('jag1:body1')) {
          const pm = m as unknown as THREE.MeshPhysicalMaterial
          pm.clearcoatRoughness = 0.18
          pm.needsUpdate = true
        }
      }
      // JAGUAR CONFIGURABLE (variante 'config'). La variante 'titi' (Jaguar #3 negro)
      // es FIJA: materiales horneados (negro + interior rojo + perno cromo) — no se
      // recolorean, aunque cop:leather1.002 / jag1:chrome_rim1.001 compartan nombre.
      if (vehicle === 'jaguar' && jaguarVariant !== 'titi') {
        const jn = m.name.toLowerCase()
        if (jn.startsWith('jaguar_body')) {
          // startsWith (no ===): si quedan materiales Jaguar_Body huérfanos en el .blend, el
          // re-export genera 'Jaguar_Body.00x' con sufijo — sin esto el recolor no matchea y el
          // body queda con el color base del GLB (se ve blanco). slider re-mapeado:
          // MATE(0)→SATÍN(0.5)→METAL(1). Satín = metal 0 + rough 0.32 + envMap
          // (brillo suave dieléctrico, NO metálico). Rugosidad piecewise: cae rápido hasta el satín,
          // después afina hacia metal. envMap sube la reflexión del entorno para que no se vea plano.
          m.color.set(paintColor)
          m.metalness = paintFinish <= 0.5 ? 0 : (paintFinish - 0.5) * 1.7
          m.roughness = paintFinish <= 0.5 ? 0.62 - 0.6 * paintFinish : 0.32 - 0.22 * (paintFinish - 0.5)
          m.envMapIntensity = 1.0 + 1.2 * paintFinish
          m.needsUpdate = true
        } else if (jn.startsWith('jaguar_stripe')) {
          m.color.set(decalColor)
          // "Sin franjas": si el color de la franja iguala al de la carrocería, igualamos
          // también el acabado (metal/rough) al del body → las franjas desaparecen del todo.
          // Solo igualar el color no alcanza: el sheen distinto las deja visibles.
          if (decalColor.toLowerCase() === paintColor.toLowerCase()) {
            m.metalness = paintFinish <= 0.5 ? 0 : (paintFinish - 0.5) * 1.7
            m.roughness = paintFinish <= 0.5 ? 0.62 - 0.6 * paintFinish : 0.32 - 0.22 * (paintFinish - 0.5)
            m.envMapIntensity = 1.0 + 1.2 * paintFinish // igualar también el reflejo del entorno: el body es más reflectivo, sin esto la franja queda más opaca y se nota
          } else {
            m.metalness = decalFinish
            m.roughness = 0.55 - 0.32 * decalFinish
          }
          m.needsUpdate = true
        } else if (jn.startsWith('jag1:chrome_rim')) {
          m.color.set(rimColor); m.metalness = Math.max(rimFinish, 0.6); m.roughness = 0.5 - 0.35 * rimFinish; m.needsUpdate = true
        } else if (jn.startsWith('headlight_yellow')) {
          // Faro amarillo: metal 0 (estable, no refleja → no "cambia de color"). Pero su
          // emisión venía muy fuerte (1.23) → lavaba el reflector y quedaba plano. La bajo y
          // subo la rugosidad para que se vea el patrón del reflector (look "foto Blender",
          // con profundidad, no calcomanía). El Titi (variante 'titi') no entra acá.
          m.metalness = 0
          m.emissiveIntensity = 0.55
          m.roughness = 0.4
          m.needsUpdate = true
        } else if (jn === 'light_glass.005') {
          // Domo de vidrio del faro: subo el reflejo del entorno para que se note la curva
          // del domo (profundidad) en vez de verse transparente/plano.
          m.envMapIntensity = 2.5
          m.roughness = 0.0
          m.needsUpdate = true
        } else if (jn.startsWith('chrome_trim')) {
          // Aro cromado del faro: venía espejo total (metal 1 / rough 0.06) → reventaba blanco
          // con el HDRI brillante. Bajo el reflejo y subo un toque la rugosidad → cromo sutil.
          m.envMapIntensity = 0.5
          m.roughness = 0.2
          m.needsUpdate = true
        } else if (jn.startsWith('cop:leather1')) {
          m.color.set(interiorTint); m.needsUpdate = true
        }
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
  }, [paintColor, paintFinish, rimColor, rimFinish, valleyColor, valleyFinish, decalColor, decalFinish, interiorTint, interiorFinish, applyToMaterials, paintMaterial, scene, vehicle, jaguarVariant])

  return (
    <group {...props} dispose={null}>
      <group ref={rigRef} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
