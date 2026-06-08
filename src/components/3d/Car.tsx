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
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader, DRACOLoader, KTX2Loader, GLTF } from 'three-stdlib'
import { useConfiguratorStore } from '@/store/useConfiguratorStore'

const MODEL_URL = '/models/SingerClean-v7.glb'
const SCALE = 1.0 // pack Singer original ya viene en metros (~4.9m de largo)

// Nombres de material reales del GLB del Singer.
// PAINT_MAT desactivado a propósito: renderizamos la pintura TAL CUAL viene del
// .blend (azul glossy autoreado en Blender) en vez de reemplazarla por un
// material dinámico. Así la web respeta el look de Blender. (Para reactivar el
// selector de color, volver a poner 'Paint ext'.)
const PAINT_MAT = 'Paint_ext'
const RIM_MATS = ['Fuchs_1', 'Fuchs_2', 'Fuchs_cap']
// El piso lo definen las ruedas de calle. Material Tire_base = meshes de
// neumático limpios y separados por rueda. (Tire_extrude/Tire_rough están
// soldados en mega-meshes de la optimización en Max → su bbox es inservible,
// llega a -27in y hacía flotar el auto ~0.6m.)
const FLOOR_MATS = ['Tire base', 'Tire_base']

// Materiales metálicos. El GLB los exportó todos con metalness=0 (SketchUp no
// autorea PBR) → se veían claros y planos. Acá les damos metalness real y un
// roughness por tipo (cromo casi espejo, aluminio satinado, escape matt).
// color opcional = neutralizar tintes placeholder obviamente mal autoreados.
// roughness más altos que antes: el environment "city" es brillante y los
// metales se veían como cromo blanco. Subiendo roughness leen como acero/alu
// cepillado (gris), no espejo. color gris neutro donde el GLB traía base blanca.
const METAL_MATS: Record<string, { metalness: number; roughness: number; color?: string }> = {
  // cromados / espejo (se mantienen brillantes, son cromo)
  Chrome: { metalness: 1, roughness: 0.14, color: '#d8d8d8' },
  Mirror: { metalness: 1, roughness: 0.08, color: '#dcdcdc' },
  Fuel_oil_caps: { metalness: 1, roughness: 0.25, color: '#cccccc' }, // tapas oil/fuel en metal
  // aluminio / acero satinado (más mate → gris, no blanco)
  Alu_ext: { metalness: 1, roughness: 0.42, color: '#b6b6b6' }, // marcos/trim de carroceria: cromado plata
  Fuchs_gold: { metalness: 1, roughness: 0.34, color: '#c9a855' }, // llanta Fuchs champagne/oro mas saturado (separado del trim)
  Alu_int: { metalness: 1, roughness: 0.52, color: '#9a9a9a' },
  Metal_ext_rough: { metalness: 1, roughness: 0.55, color: '#a0a0a0' },
  Wiper_metal: { metalness: 1, roughness: 0.5, color: '#8f8f8f' },
  Bolt_wheel: { metalness: 1, roughness: 0.45 },
  // disco de freno: hierro fundido OSCURO + metalness BAJO. CLAVE: con metalness
  // alto el disco ESPEJA el HDRI brillante del environment → se ve como un relleno
  // claro y plano que tapa las aletas/profundidad (bug "fondo relleno"). Bajando
  // metalness deja de espejar → se ven las aletas radiales, los bulones y el fondo
  // recesado, como en Blender (mundo oscuro). La pinza (Brake_caliper) sigue roja.
  Brake_disc: { metalness: 0.2, roughness: 0.6, color: '#2b2b2b' },
  // aletas/cuerpo del rotor = lo que da la profundidad detrás de los rayos. Mismo
  // criterio: oscuro + poco metálico para que no se lave con el environment.
  Brakes_black: { metalness: 0.25, roughness: 0.55, color: '#1c1c1c' },
  Valve_metal: { metalness: 1, roughness: 0.45 },
  Momo_silver: { metalness: 1, roughness: 0.45 },
  Momo_bolts: { metalness: 1, roughness: 0.5 },
  Momo_black_metal: { metalness: 1, roughness: 0.5 },
  // Speaker_mesh NO va metalico: en el .blend es metal=0 mate negro. Forzarlo a
  // metalness=1 lo hacia reflejar el environment -> se veia gris claro. Sin override.
  Footwell_plate: { metalness: 0.3, roughness: 0.6, color: '#1c1c1c' },
  // oro (emblemas)
  Emblem_gold: { metalness: 1, roughness: 0.28 },
  Emblem_gold_bump: { metalness: 1, roughness: 0.35 },
  Emblem_gold_normal: { metalness: 1, roughness: 0.35 },
  // salidas de escape: acero cepillado (pulido se quemaba a blanco con el env)
  Exhaust_matt: { metalness: 1, roughness: 0.42, color: '#8f8f8f' },
  // pinza de freno: PINTURA roja (no metal). El material nonodes exportaba con
  // metalness=1 → quedaba rojo metálico oscuro. Forzamos metalness 0.
  Brake_caliper: { metalness: 0, roughness: 0.4, color: '#b81818' },
  // cromos de las luces: venían en roughness 0 (espejo perfecto) → de lejos
  // aliasing especular = cuadrados negros en los marcos. Subimos roughness.
  Lamp_chrome: { metalness: 1, roughness: 0.16, color: '#d6d6d6' }, // reflector cromado (refleja, no mate)
  Headlamp_bulb: { metalness: 1, roughness: 0.22, color: '#cfcfcf' },
}

// Acabado de materiales NO metálicos (no necesita UV ni texturas): solo
// roughness para que cuero/alfombra/plástico dejen de verse como plástico
// brillante. El color de cada uno se ajusta después contra las fotos de ref.
const FINISH_MATS: Record<string, number> = {
  // interiores: subidos para matar el brillo de cuero/plástico bajo el env
  PBR_Basket_Weave_001: 0.8, // MATE como tela (refleja poco, "como cuero"); antes 0.42 reflejaba y cambiaba el tono
  Butaca_cuero_liso: 0.6, // cuero liso mate (reflejo sutil de cuero, no espejado)
  Leather_BK_rough: 0.82,
  Leather_BR_rough: 0.82,
  Leather_BG_rough: 0.82,
  Leather_BK_glossy: 0.55,
  Leather_BR_glossy: 0.55,
  Leather_WH_glossy: 0.55,
  Carpet_in: 0.97,
  Headlining: 0.95,
  Plastic_int_matt: 0.9,
  Plastic_button_matt: 0.85,
  Recaro_paint: 0.6,
  Momo_leather: 0.78,
  Momo_rubber: 0.92,
  Int_glossy: 0.3, // piano black: menos espejo
  Pedal_top: 0.65,
  Seatbelt: 0.88,
  // gomas de neumático: roughness alto pero NO total (la goma real refleja algo).
  Rubber: 0.82,
  Tire_rough: 0.8,
  Tire_base: 0.85,
  Tire_extrude: 0.85,
  Wiper_rubber: 0.92,
  Plastic_ext_matt: 0.9,
}

// Color forzado (además del roughness). Las alfombras del pack venían claras
// (Carpet_out casi blanco, Carpet_in gris) → las llevamos a negro.
// Vidrios de FAROS (no las ventanas): se les saca la transmission para que no
// desaparezcan a distancia. Glass_ext (ventanas) se deja como está.
const LENS_GLASS = new Set(['Headlamp_glass', 'Glass_red', 'Glass_orange', 'Glass_parking_light'])

const COLOR_MATS: Record<string, string> = {
  Carpet_in: '#141414',
  Carpet_out: '#141414',
  // gomas: charcoal (no negro puro) → la goma real no es negro absoluto, refleja
  // un poco. Con el normal map del neumático da micro-bump/realismo.
  Rubber: '#1b1b1b',
  Tire_rough: '#1b1b1b',
  Tire_base: '#1b1b1b',
  Tire_extrude: '#1b1b1b',
  // materiales DIFFUSE del pack que salen BLANCOS al exportar a glTF (el exporter
  // pierde el color de los BSDF_DIFFUSE). Les forzamos su color oscuro real.
  // Plastic_int_matt = PISO interno bajo butacas/pedaleras (era el blanco).
  Plastic_int_matt: '#161616',
  Plastic_gauge_bck: '#0e0e0e',
  Plastic_button_matt: '#121212',
  Radio_screen: '#0a0a0a',
  Headlining: '#3a3a3a',
  Carpet: '#141414',
  // Butacas + weave: color EXACTO de v5 → ver V5_LINEAR abajo (seteado en lineal).
}

// Interior mate (weave/cuero caramelo): el environment brillante del studio (pensado para la
// pintura glossy) los "lava" a crema/desaturados. Bajamos su envMapIntensity para que rindan
// su caramelo rico real, como en la Vista Materiales de Blender.
const INT_RICH: Record<string, number> = {
  // MISMO env en todo el caramelo del interior -> color UNIFORME (antes estaba disparejo:
  // paneles 0.35 mas oscuros que butacas 0.5).
  'PBR_Basket_Weave.001': 0.42,
  Seat_weave_caramel: 0.42,
  Butaca_cuero_liso: 1.0,
  Vent_caramel_paint: 0.42,
  'Vent_caramel_paint.001': 0.42,
  'Leather_BG_rough.001': 0.42,
  Leather_BG_rough_002: 0.42, // env = vent (la key dotted .002 no matcheaba el nombre del GLB)
  Momo_leather: 0.5,
  // butaca re-topo: env más alto para que el cognac de v5 rinda bien iluminado
  // bajo warehouse (más tenue que studio) y no quede oscuro.
  LP_butaca_mat: 1.0,
  // basket weave (puertas/dash/guanteras): env 0.42 = igual que los vents (match).
  PBR_Basket_Weave_001: 0.42,
  // Faros/cromos: env alto -> espejan el sunset con fuerza (dejan de verse opacos).
  Chrome: 1.6,
  Lamp_chrome: 2.0,
  Headlamp_bulb: 2.0,
}

// Colores EXACTOS del interior de v5 (efectivos, resueltos de los MIX nodes de v5).
// Se setean en LINEAL con setRGB → multiplican la textura v6 para dar EXACTO el
// color de v5, independiente del HDRI (valores fijos = NO cambian de color).
// Fórmula: color_lineal = color_efectivo_v5 / promedio_textura_v6.
const V5_LINEAR: Record<string, [number, number, number]> = {
  // LP_butaca_mat: el camel de v5 ahora está HORNEADO en el GLB (albedo sólido +
  // normal del tejido), así que ya no se tinta acá.
  // Tejido canasta (paneles de puerta + dashboard + guanteras de ambas puertas).
  // DEBE igualar a los VENTS (Vent_caramel_paint, color efectivo [0.395,0.18,0.03],
  // renderiza pálido [177,156,138]). CLAVE/RAÍZ: el promedio REAL de la textura del GLB
  // es [0.313,0.153,0.049] (MEDIDO con readPixels, NO [0.441,...] que asumía mal) — por
  // eso TODOS los tints anteriores daban rojo profundo [0.346,0.088,0.014]. tint correcto
  // = color_vent / avg_real: [0.395,0.18,0.03] / [0.313,0.153,0.049] = [1.262,1.176,0.612].
  PBR_Basket_Weave_001: [1.262, 1.176, 0.612], // efectivo = color del vent (match)
  PBR_Basket_Weave_002: [1.262, 1.176, 0.612], // idem (por si el dashboard usa el _002)
  Butaca_cuero_liso: [0.4874, 0.2247, 0.0633], // cuero liso (sólido) = color directo de v5
}

// Valores EXACTOS de material de v5 (color efectivo LINEAL + metalness + roughness),
// leídos de singer_v5_editable.blend resolviendo los MIX nodes. Materiales SÓLIDOS de
// interior + llantas + cromos de faros (rough casi-espejo de v5). NO incluye: selector
// de pintura/llanta, los vidrios (transparencia), ni las butacas texturadas (V5_LINEAR).
const V5_EXACT: Record<string, { c: [number, number, number]; m?: number; r?: number }> = {
  // INTERIOR
  Plastic_int_matt: { c: [0.058, 0.058, 0.058], m: 0, r: 0.9 },
  Plastic_button_matt: { c: [0.05, 0.05, 0.05], m: 0, r: 0.9 },
  Plastic_gauge_bck: { c: [0.058, 0.058, 0.058], m: 0, r: 0.9 },
  Vent_black: { c: [0.012, 0.012, 0.012], m: 0, r: 0.5 },
  Vent_caramel_paint: { c: [0.395, 0.18, 0.03], m: 0.1, r: 0.42 },
  Vent_caramel_paint_001: { c: [0.395, 0.18, 0.03], m: 0.1, r: 0.42 },
  Momo_leather: { c: [0.07, 0.07, 0.07], m: 0, r: 0.5 },
  Momo_leather_001: { c: [0.07, 0.07, 0.07], m: 0, r: 0.5 },
  Momo_rubber: { c: [0.099, 0.099, 0.099], m: 0, r: 0.9 },
  Momo_black_metal: { c: [0.029, 0.029, 0.029], m: 1, r: 0.45 },
  Momo_bolts: { c: [0.067, 0.067, 0.067], m: 1, r: 0.45 },
  Momo_logo: { c: [0.033, 0.033, 0.033], m: 0, r: 0.5 },
  Momo_silver: { c: [0.528, 0.709, 0.8], m: 1, r: 0.22 },
  Momo_stitches: { c: [0.8, 0.8, 0.8], m: 0, r: 0.96 },
  Leather_BK_rough: { c: [0.008, 0.008, 0.008], m: 0, r: 0.5 },
  Leather_BK_glossy: { c: [0.009, 0.009, 0.009], m: 0, r: 0.45 },
  Leather_BG_rough_002: { c: [0.395, 0.18, 0.03], m: 0, r: 0.42 }, // guanteras + cuero trim = tono del vent (Vent_caramel_paint)
  Leather_BG_rough_001: { c: [0.787, 0.605, 0.334], m: 0, r: 0.9 }, // dash trim claro = tan claro EXACTO de v5
  Seat_belt_red: { c: [0.8, 0, 0], m: 0, r: 0.9 },
  Valve_plastic: { c: [0, 0, 0], m: 0, r: 0.9 },
  Footwell_plate: { c: [0.011, 0.011, 0.011], m: 0, r: 0.5 },
  Radio_screen: { c: [0.029, 0.04, 0.028], m: 0, r: 0.9 },
  // FAROS / CROMOS — v5 los tiene en rough 0 (espejo). El web los tenía mate
  // (0.14-0.22) => se veían opacos. Casi-espejo (un hilo > 0 evita aliasing) + tono cromo de v5.
  Chrome: { c: [1, 1, 1], m: 1, r: 0.06 },
  Lamp_chrome: { c: [1, 1, 1], m: 1, r: 0.05 },
  Headlamp_bulb: { c: [1, 1, 1], m: 1, r: 0.06 },
  // LLANTAS
  Brakes_black: { c: [0.103, 0.103, 0.103], m: 0, r: 0.9 },
  Brake_disc: { c: [0.8, 0.8, 0.8], m: 1, r: 0.7 },
  Bolt_wheel: { c: [0.8, 0.8, 0.8], m: 1, r: 0.45 },
  Tire_base: { c: [0.021, 0.021, 0.021], m: 0, r: 0.41 },
  Tire_rough: { c: [0.007, 0.007, 0.007], m: 0, r: 0.5 },
  Tire_extrude: { c: [0.018, 0.018, 0.018], m: 0, r: 0.39 },
  Rubber: { c: [0.011, 0.011, 0.011], m: 0, r: 0.5 },
  Emblem_blck: { c: [0.007, 0.007, 0.007], m: 0, r: 0.9 },
  Brake_caliper: { c: [0.479, 0.009, 0.009], m: 0, r: 0.4 },
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
  const capTexRef = useRef<THREE.CanvasTexture | null>(null)
  const paintColor = useConfiguratorStore((s) => s.paintColor)
  const rimStyle = useConfiguratorStore((s) => s.rimStyle)

  // Pintura propia: MeshPhysicalMaterial con clearcoat → refleja el environment
  // como pintura de auto. Reemplaza al Paint_ext original, que venía sin
  // clearcoat (plano, sin reflejo) y con una baseColorTexture horneada que
  // apagaba el color elegido. Sin map → el color del selector se ve puro.
  const paintMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0a1c3a'),
      metalness: 0.85, // pintura METÁLICA (flake) — como el auto real: profundo
      roughness: 0.42, // brillo del flake bajo la laca
      clearcoat: 1.0, // laca
      clearcoatRoughness: 0.035, // laca profunda → reflejos largos/nítidos (wet look)
      envMapIntensity: 1.7, // reflejos de estudio marcados (deep gloss)
    })
    m.name = 'Paint_ext_dynamic'
    return m
  }, [])

  // El GLB tiene materiales DUPLICADOS por nombre (varias instancias del mismo
  // material en distintos meshes). Por eso no alcanza con indexar uno por nombre:
  // hay que recorrer TODOS los slots y aplicar el override a cada instancia, si
  // no quedan piezas sin tocar (gomas/alfombras/relojes blancos).
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

  // Filtrado de texturas: anisotrópico + trilineal. Sin esto, de lejos el motor
  // usa mipmaps de baja resolución y las superficies con normal map / detalle
  // (faros, acrílico, metales) se ven en "cuadrados" / glitchean. Esto lo arregla.
  useLayoutEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    const seen = new Set<THREE.Texture>()
    const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        for (const k of keys) {
          const tex = (m as Record<string, unknown>)[k] as THREE.Texture | null
          if (tex && !seen.has(tex)) {
            seen.add(tex)
            tex.anisotropy = maxAniso
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.generateMipmaps = true
            tex.needsUpdate = true
          }
        }
      }
    })
  }, [scene, gl])

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

    // Fuchs estilo Singer (ref real): las CARAS de los radios + el LABIO/aro
    // exterior (Fuchs_1) van en aluminio satinado = color del selector. Los
    // VALLES/recovecos (Fuchs_2) van en NEGRO satinado fijo. El CENTRO (cap) en
    // aluminio satinado. Acabado satinado (roughness alto) → sin cromo.
    applyToMaterials((m) => {
      if (m.name === 'Fuchs_1') {
        m.color.set(rimStyle.hex) // caras de radios + labio/aro exterior
        m.metalness = rimStyle.metalness
        m.roughness = rimStyle.roughness
        m.envMapIntensity = 0.8 // un poco menos iluminada (sin recolorear)
      } else if (m.name === 'Fuchs_2') {
        m.color.set('#9a9da0') // valles = aluminio satinado (mismo tono, NO oscuro)
        m.metalness = 1
        m.roughness = 0.55
        m.envMapIntensity = 0.8
      } else if (m.name === 'Fuchs_cap') {
        m.color.set('#aeb1b4') // tapacubos central = aluminio satinado
        m.metalness = 1
        m.roughness = 0.5
        m.envMapIntensity = 0.8
      }
    })
  }, [paintColor, rimStyle, applyToMaterials, paintMaterial])

  // Overrides estáticos de material (una vez, al cargar). Recorre TODAS las
  // instancias para cubrir los materiales duplicados por nombre del GLB.
  useLayoutEffect(() => {
    applyToMaterials((m) => {
      const cfg = METAL_MATS[m.name]
      if (cfg) {
        m.metalness = cfg.metalness
        m.roughness = cfg.roughness
        // color: SIN override → se usa el baseColor HORNEADO del GLB (Blender,
        // verificado exacto: Alu/Chrome/Mirror/Exhaust = #e7e7e7/#ffffff/#878787).
        // El color vive en el GLB, no se parcha en JS. Ver Pipeline_GLB_Source_of_Truth.
        m.envMapIntensity = 1.0 // reflejos neutros (AgX ya da el look de Blender)
      }
      if (m.name in FINISH_MATS) m.roughness = FINISH_MATS[m.name]
      if (m.name in COLOR_MATS) m.color.set(COLOR_MATS[m.name])
      // Color EXACTO de v5 (lineal): para texturas v6 (butaca/weave) el valor
      // multiplica el mapa y da el color de v5; para sólidos lo setea directo.
      if (m.name in V5_LINEAR) {
        const [lr, lg, lb] = V5_LINEAR[m.name]
        m.color.setRGB(lr, lg, lb, THREE.LinearSRGBColorSpace)
      }
      // Valores EXACTOS de v5 (color lineal + metal + rough) para sólidos de
      // interior/llantas. Pisa los overrides anteriores (METAL_MATS/COLOR_MATS/FINISH).
      if (m.name in V5_EXACT) {
        const e = V5_EXACT[m.name]
        m.color.setRGB(e.c[0], e.c[1], e.c[2], THREE.LinearSRGBColorSpace)
        if (e.m !== undefined) m.metalness = e.m
        if (e.r !== undefined) m.roughness = e.r
      }
      if (m.name in INT_RICH) m.envMapIntensity = INT_RICH[m.name]
      // Butaca_cuero_liso (cuero liso de butacas + asientos traseros Plane167/170/174/177):
      // CON LUZ y MATE, como cuero real. Antes era plano/emisivo a x2 -> se veía brillante
      // y "glowing", no como cuero. Ahora: color por V5_LINEAR, env 1.0 (INT_RICH), rough
      // 0.6 (FINISH_MATS) -> tono cuero de los asientos, reflejo sutil (no espejado).
      // Vidrio de relojes: venía blanco opaco (base 0.8) tapando el dial.
      // Lo hacemos vidrio oscuro casi transparente → se ve el reloj negro debajo.
      if (m.name === 'Gauge_glass') {
        m.color.set('#0a0a0a')
        m.metalness = 0
        m.roughness = 0.08
        m.transparent = true
        m.opacity = 0.2
        m.needsUpdate = true
      }
      // Espejo retrovisor: reflejo. Con el env atenuado (0.65) reflejaba oscuro
      // → se veía negro. Le subimos envMapIntensity para que espeje brillante.
      if (m.name === 'Mirror') {
        m.color.set('#eaeaea')
        m.metalness = 1
        m.roughness = 0.05
        m.envMapIntensity = 3.0
      }
      // Aro/reflector del faro: z-fighting con el parachoques en la esquina. Lo
      // tiramos hacia la cámara para que el faro quede por encima del paragolpe.
      if (m.name === 'Lamp_chrome') {
        m.polygonOffset = true
        m.polygonOffsetFactor = -8
        m.polygonOffsetUnits = -8
        m.needsUpdate = true
      }
      // Vidrios de faros: usaban transmission (refracción) + alpha baja → de lejos
      // la transmission no se renderiza y los cristales DESAPARECEN. Les sacamos
      // la transmission (transparencia simple estable) y subimos piso de opacidad.
      if (LENS_GLASS.has(m.name)) {
        const pm = m as THREE.MeshPhysicalMaterial
        // Vidrio REAL con transmission, CLEAR como en v5/Blender (se ve el reflector
        // cromado nítido adentro). CLAVE: depthWrite=TRUE + SIN polygonOffset. El combo
        // anterior (depthWrite=false + polygonOffset -8) causaba el bug de "rayos X" (se
        // veía el fondo de las ópticas a través del guardabarros) y bordes tipo wireframe.
        pm.metalness = 0
        pm.thickness = 0.15
        pm.transparent = true
        pm.opacity = 1
        pm.clearcoat = 0
        pm.depthWrite = true
        pm.polygonOffset = false
        if (m.name === 'Headlamp_glass') {
          pm.transmission = 1; pm.ior = 1.5; pm.roughness = 0.04
          pm.color.setRGB(1, 1, 1); pm.envMapIntensity = 1.5
        } else if (m.name === 'Glass_parking_light') {
          pm.transmission = 1; pm.ior = 1.45; pm.roughness = 0.05
          pm.color.setRGB(1, 1, 1); pm.envMapIntensity = 1.0
        } else if (m.name === 'Glass_orange') {
          pm.transmission = 1; pm.ior = 1.45; pm.roughness = 0.05
          pm.color.setRGB(1, 0.298, 0.01); pm.envMapIntensity = 1.0
        } else if (m.name === 'Glass_red') {
          pm.transmission = 1; pm.ior = 1.45; pm.roughness = 0.05
          pm.color.setRGB(1, 0.038, 0.038); pm.envMapIntensity = 1.0
        }
        pm.needsUpdate = true
      }
      // Ventanas (Glass_ext): vidrio con tinte leve + reflejos fuertes del estudio
      // + oscurece el interior (vende realismo). Sin transmission pesada (estable).
      if (m.name === 'Glass_ext') {
        const pm = m as THREE.MeshPhysicalMaterial
        if ('transmission' in pm) pm.transmission = 0
        pm.color.set('#2c333b') // tinte más claro (menos oscuro)
        pm.metalness = 0
        pm.roughness = 0.03
        // env BAJO: el reflejo fuerte del sunset lavaba el interior visto a través
        // del parabrisas (medido: butacas se veían pálidas). Bajado 2.2 -> 0.6 +
        // más transparente -> el interior camel se lee a través del vidrio.
        pm.envMapIntensity = 0.6
        pm.transparent = true
        pm.opacity = 0.32 // más transparente → se ve mejor el interior
        pm.depthWrite = false
        pm.needsUpdate = true
      }
      // Acrílico del spoiler (Plexi_bubbles): material procedural transparente con
      // textura de huecos → de lejos glitchea (verde en cuadrados). Lo limpiamos a
      // un plexi ahumado translúcido liso (sin textura) → deja de buguear.
      if (m.name === 'Plexi_bubbles') {
        m.map = null
        m.normalMap = null
        m.roughnessMap = null
        m.metalnessMap = null
        if (m.emissive) m.emissive.set('#000000')
        m.color.set('#1c1f1c')
        m.metalness = 0
        m.roughness = 0.12
        m.transparent = true
        m.opacity = 0.6
        m.depthWrite = false
        m.needsUpdate = true
      }
      // Tapas oil/fuel: metal con letras CALADAS en relieve. Sacamos la textura de
      // color (tapón negro) y la metallicRoughness, pero potenciamos el normalMap
      // (que trae el relieve de las letras) para que se vean grabadas en el metal.
      if (m.name === 'Fuel_oil_caps') {
        // La textura del pack es fondo NEGRO con letras BLANCAS → usada directa
        // el tapón sale negro. La INVERTIMOS (fondo→claro=metal, letras→gris) y
        // la usamos de color: tapón metal con letras apenas más oscuras + relieve.
        if (!capTexRef.current && m.map && (m.map as THREE.Texture).image) {
          const img = (m.map as THREE.Texture).image as HTMLImageElement
          const cv = document.createElement('canvas')
          cv.width = img.width
          cv.height = img.height
          const cx = cv.getContext('2d')!
          cx.drawImage(img, 0, 0)
          const data = cx.getImageData(0, 0, cv.width, cv.height)
          const px = data.data
          for (let i = 0; i < px.length; i += 4) {
            // fondo negro(0)→~235 (metal claro); letras blancas(255)→~120 (gris)
            const out = 235 - px[i] * 0.45
            px[i] = px[i + 1] = px[i + 2] = out
          }
          cx.putImageData(data, 0, 0)
          const t = new THREE.CanvasTexture(cv)
          t.flipY = (m.map as THREE.Texture).flipY
          t.colorSpace = (m.map as THREE.Texture).colorSpace
          t.needsUpdate = true
          capTexRef.current = t
        }
        if (capTexRef.current) m.map = capTexRef.current
        m.metalnessMap = null
        m.roughnessMap = null
        m.color.set('#ffffff') // el tono lo da la textura invertida
        m.metalness = 1
        m.roughness = 0.42
        if (m.normalMap) m.normalScale = new THREE.Vector2(2.5, 2.5)
        m.needsUpdate = true
      }
    })
  }, [applyToMaterials])

  return (
    <group {...props} dispose={null}>
      <group ref={rigRef} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
