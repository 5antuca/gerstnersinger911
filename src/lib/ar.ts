import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/*
  Realidad aumentada en el celular ("Ver en tu espacio").

  La escena viva del configurador ya es el auto CONFIGURADO (colores, acabados,
  puertas), centrado y apoyado en el piso, en METROS reales (Porsche 4,13 m,
  Jaguar 4,29 m). Así que para el 1:1 alcanza con exportarla tal cual a un GLB
  en memoria y dárselo a <model-viewer>, que resuelve el AR de cada sistema:
    - Android: WebXR (Chrome con ARCore).
    - iPhone:  Quick Look, con el USDZ que model-viewer genera del mismo GLB.
  No hay archivos por preset ni pipeline aparte: lo que ves es lo que se lleva.

  ⚠️ Lo que se pinta con shaders propios (onBeforeCompile) NO viaja en el
  export: las franjas Singer de butacas/puertas/tablero y la cara interna oscura
  de la chapa. El resto sí (son colores/acabados de material).
*/

// El rig del auto (Car.tsx lo registra). Es el que tiene el centrado + apoyo en
// el piso; exportarlo a él (y no la escena del GLB) deja el auto parado en y=0.
export const rigAR: { current: THREE.Object3D | null } = { current: null }

// Texturas a 2048 como máximo: es lo que ya usa el GLB de la web, y en el
// celular un export más grande solo suma memoria.
const MAX_TEXTURA = 2048

/*
  Geometría liviana para el celular.

  El auto de la web tiene ~1,8 millones de vértices (la mitad son las 4 ruedas:
  cubierta, bulones, emblema). En la compu sobra; en el celular no: el USDZ que
  arma Quick Look para iPhone salía de 134 MB (ASCII, y escribe cada rueda por
  separado aunque compartan geometría). Así que antes de exportar se simplifica
  una COPIA del auto con meshoptimizer, con un error máximo chico respecto del
  tamaño de cada pieza: lo que se pierde son subdivisiones de milímetros, que a
  escala real no se ven. La escena del configurador no se toca.
*/
// Piezas con menos vértices que esto quedan intactas (no vale la pena).
const MIN_VERTICES = 2000
// Apuntar a quedarse con el 15% de los triángulos…
const PROPORCION = 0.15
// …pero sin deformar más que el 0,6% del tamaño de la pieza (en una cubierta,
// unos 4 mm: en goma negra no se ve).
const ERROR_MAX = 0.006
// Lo que REFLEJA no se simplifica: en la pintura, el vidrio o el cromo los
// triángulos grandes se ven como manchas en el reflejo (probado: el capó salía
// moteado). Los calcos tampoco: van pegados a la chapa y se hundirían en ella.
const NO_SIMPLIFICAR = /paint|body|glass|chrome|mirror|decal|stripe/i

function seSimplifica(m: THREE.Mesh): boolean {
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  return !mats.some((mat) => NO_SIMPLIFICAR.test(mat?.name ?? ''))
}

async function geometriaLiviana(
  geo: THREE.BufferGeometry,
  simplificador: typeof import('meshoptimizer').MeshoptSimplifier,
): Promise<THREE.BufferGeometry> {
  const pos = geo.attributes.position
  const index = geo.index
  // Fuera: piezas chicas, sin índice, multi-material o con morphs.
  if (
    !index ||
    pos.count < MIN_VERTICES ||
    geo.groups.length > 1 ||
    Object.keys(geo.morphAttributes).length
  ) {
    return geo
  }

  const posiciones = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    posiciones[i * 3] = pos.getX(i)
    posiciones[i * 3 + 1] = pos.getY(i)
    posiciones[i * 3 + 2] = pos.getZ(i)
  }
  const indices = Uint32Array.from(index.array as ArrayLike<number>)
  const objetivo = Math.max(3, Math.floor((indices.length * PROPORCION) / 3) * 3)
  // LockBorder: no mover los bordes abiertos (costuras de UV, cortes de
  // material) para que no aparezcan grietas entre piezas.
  const [nuevos] = simplificador.simplify(indices, posiciones, 3, objetivo, ERROR_MAX, ['LockBorder'])
  if (nuevos.length >= indices.length * 0.9) return geo // casi no ganó nada

  // Quitar los vértices que quedaron sin usar (si no, el archivo pesa igual).
  const [remap, unicos] = simplificador.compactMesh(nuevos)
  const salida = new THREE.BufferGeometry()
  for (const [nombre, attr] of Object.entries(geo.attributes)) {
    const a = attr as THREE.BufferAttribute
    const Tipo = (a.array as Float32Array).constructor as Float32ArrayConstructor
    const arr = new Tipo(unicos * a.itemSize)
    for (let v = 0; v < a.count; v++) {
      const destino = remap[v]
      if (destino === 0xffffffff) continue
      for (let k = 0; k < a.itemSize; k++) arr[destino * a.itemSize + k] = a.getComponent(v, k)
    }
    salida.setAttribute(nombre, new THREE.BufferAttribute(arr, a.itemSize, a.normalized))
  }
  salida.setIndex(new THREE.BufferAttribute(nuevos, 1))
  return salida
}

async function copiaLiviana(rig: THREE.Object3D): Promise<THREE.Object3D> {
  const { MeshoptSimplifier } = await import('meshoptimizer')
  await MeshoptSimplifier.ready
  const copia = rig.clone(true)
  // Las 4 ruedas comparten geometría: se simplifica UNA vez y se reusa.
  const hechas = new Map<string, THREE.BufferGeometry>()
  const mallas: THREE.Mesh[] = []
  copia.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) mallas.push(o as THREE.Mesh)
  })
  for (const m of mallas) {
    if (!seSimplifica(m)) continue
    const original = m.geometry
    let liviana = hechas.get(original.uuid)
    if (!liviana) {
      liviana = await geometriaLiviana(original, MeshoptSimplifier)
      hechas.set(original.uuid, liviana)
    }
    m.geometry = liviana
  }
  return copia
}

export async function exportarAutoGLB(): Promise<Blob> {
  const rig = rigAR.current
  if (!rig) throw new Error('El auto todavía no cargó')
  rig.updateWorldMatrix(true, true)
  const copia = await copiaLiviana(rig)

  const exporter = new GLTFExporter()
  const glb = await exporter.parseAsync(copia, {
    binary: true,
    onlyVisible: true,
    maxTextureSize: MAX_TEXTURA,
  })
  return new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' })
}

// model-viewer autocontenido (trae su propio three), servido desde el repo:
// sin conflicto de versiones con el three del proyecto y sin depender de un
// CDN de terceros (ver el incidente de los HDRI, 2026-08-17). Se carga recién
// cuando alguien toca el botón: no pesa en la carga normal del configurador.
const MODEL_VIEWER_SRC = '/vendor/model-viewer-4.3.1.min.js'
let cargaModelViewer: Promise<void> | null = null

export function cargarModelViewer(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (customElements.get('model-viewer')) return Promise.resolve()
  if (!cargaModelViewer) {
    cargaModelViewer = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.type = 'module'
      s.src = MODEL_VIEWER_SRC
      s.onload = () => customElements.whenDefined('model-viewer').then(() => resolve())
      s.onerror = () => {
        cargaModelViewer = null // permitir reintentar
        reject(new Error('No se pudo cargar el visor de realidad aumentada'))
      }
      document.head.appendChild(s)
    })
  }
  return cargaModelViewer
}
