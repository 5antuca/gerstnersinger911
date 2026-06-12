<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Perfiles de color (persistencia)

Los perfiles guardados por el usuario son SAGRADOS: nunca implementar nada que
pueda perderlos. Arquitectura (src/app/api/perfiles/route.ts + page.tsx):

- **Nube**: Upstash Redis vía REST. En Vercel: Storage → Create → Upstash Redis
  (free) → conectar al proyecto → Redeploy. Inyecta `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` (o `KV_REST_API_*`). Hashes: `gw:perfiles` y
  `gw:perfiles:trash` (papelera con contenido completo — borrar NUNCA destruye).
- **localStorage** (`gw_perfiles`) = caché instantánea/offline. Al montar se
  mergea con la nube por nombre (gana `updatedAt` más nuevo; tombstones tapan
  borrados) y lo local-nuevo se sube solo.
- **Sin backend configurado** la web degrada a localStorage sin romperse
  (la API responde `storage:'none'`; el tab Cargar muestra "⚠ solo este
  dispositivo"). En `next dev` el storage es `.dev-perfiles.json` (gitignored).
