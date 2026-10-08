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
  salida.setIndex(indicesAjustados(nuevos, unicos))
  return salida
}

/*
  Indices en 16 bits cuando la pieza tiene menos de 65.536 vertices.

  El exportador los escribe SIEMPRE en 32 bits: eran 10,3 MB de los 26,2 de
  geometria del auto entero, y casi ninguna pieza necesita tanto rango. Pasar a
  16 bits es exactamente la misma malla ocupando la mitad — no se pierde ni un
  triangulo. (2026-10-08)
*/
function indicesAjustados(idx: Uint32Array, vertices: number): THREE.BufferAttribute {
  if (vertices < 65536) return new THREE.BufferAttribute(Uint16Array.from(idx), 1)
  return new THREE.BufferAttribute(idx, 1)
}

/*
  Cache de geometrias ya simplificadas, a nivel modulo.

  Simplificar es lo caro del proceso, y la geometria NO depende de la
  configuracion: cambiar color, acabado o abrir puertas no mueve un vertice.
  Guardandolas, la segunda vez que alguien abre el AR (y cualquier cambio de
  color despues) ya no paga ese costo. La clave es el uuid de la geometria
  original, asi que cambiar de vehiculo entra solo como claves nuevas.
  Las 4 ruedas comparten geometria: se simplifica una vez para las cuatro.
*/
const yaSimplificadas = new Map<string, THREE.BufferGeometry>()

async function simplificador() {
  const { MeshoptSimplifier } = await import('meshoptimizer')
  await MeshoptSimplifier.ready
  return MeshoptSimplifier
}

function mallasDe(rig: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  rig.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh)
  })
  return out
}

async function copiaLiviana(rig: THREE.Object3D): Promise<THREE.Object3D> {
  const simp = await simplificador()
  const copia = rig.clone(true)
  for (const m of mallasDe(copia)) {
    if (!seSimplifica(m)) continue
    const original = m.geometry
    let liviana = yaSimplificadas.get(original.uuid)
    if (!liviana) {
      liviana = await geometriaLiviana(original, simp)
      yaSimplificadas.set(original.uuid, liviana)
    }
    m.geometry = liviana
  }
  // Pasada final de indices: hay TRES caminos por los que una pieza llega
  // hasta aca (simplificada, excluida por material, o descartada por chica) y
  // solo el primero pasaba por indicesAjustados. Haciendolo al final se cubren
  // los tres de una. Las geometrias compartidas (las 4 ruedas) se convierten
  // una sola vez.
  const convertidas = new Map<string, THREE.BufferGeometry>()
  for (const m of mallasDe(copia)) {
    const i = m.geometry.index
    if (!i || !(i.array instanceof Uint32Array)) continue
    if (m.geometry.attributes.position.count >= 65536) continue
    const yaEsta = convertidas.get(m.geometry.uuid)
    if (yaEsta) { m.geometry = yaEsta; continue }
    const g = m.geometry.clone()
    g.setIndex(indicesAjustados(i.array as Uint32Array, m.geometry.attributes.position.count))
    convertidas.set(m.geometry.uuid, g)
    m.geometry = g
  }
  return copia
}

/*
  Adelantar el trabajo pesado mientras el usuario mira el auto.

  Se simplifica de a UNA pieza por hueco libre del navegador
  (requestIdleCallback): si el usuario rota o cambia un color, el configurador
  sigue fluido y esto espera. Para cuando toca "Ver en tu espacio", la mayoria
  ya esta en el cache y el export arranca casi de una.
*/
export function precalentarAR(): void {
  if (typeof window === 'undefined') return
  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void
  }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))

  void (async () => {
    const rig = rigAR.current
    if (!rig) return
    const simp = await simplificador()
    const pendientes = mallasDe(rig).filter(
      (m) => seSimplifica(m) && !yaSimplificadas.has(m.geometry.uuid),
    )
    const siguiente = () => {
      const m = pendientes.shift()
      if (!m) return
      if (!yaSimplificadas.has(m.geometry.uuid)) {
        void geometriaLiviana(m.geometry, simp).then((g) => {
          yaSimplificadas.set(m.geometry.uuid, g)
          idle(siguiente, { timeout: 2000 })
        })
      } else {
        idle(siguiente, { timeout: 2000 })
      }
    }
    idle(siguiente, { timeout: 2000 })
  })()
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
