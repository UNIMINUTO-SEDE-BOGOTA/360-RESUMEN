
  # Connect Azure Data Display

  This is a code bundle for Connect Azure Data Display. The original project is available at https://www.figma.com/design/IdHeepZTSshVaRhVkeXLMO/Connect-Azure-Data-Display.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## API failover

  El frontend usa Render como backend principal y Vercel como respaldo. Las
  lecturas pasan por `src/app/services/apiClient.ts`, que implementa un circuit
  breaker sin health checks periodicos. Se puede configurar con:

  - `VITE_API_PRIMARY_URL` (compatible tambien con `VITE_API_URL`)
  - `VITE_API_FALLBACK_URL`
  - `VITE_API_PRIMARY_TIMEOUT_MS` (3000 ms por defecto)
  - `VITE_API_FALLBACK_TIMEOUT_MS` (10000 ms por defecto)

  Las operaciones con efectos, como el warmup, no se envian desde el frontend.

  ## Actualizacion manual de Redis

  El warmup no depende de Render ni de Vercel. El workflow
  `.github/workflows/warmup-cache.yml` consulta Azure SQL y escribe directamente
  en el Upstash compartido por ambos backends.

  Configura estos secretos en `Settings > Secrets and variables > Actions`:

  - `AZURE_SQL_SERVER`
  - `AZURE_SQL_DATABASE`
  - `AZURE_SQL_USER`
  - `AZURE_SQL_PASSWORD`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

  Para actualizar, abre `Actions > Actualizar cache Redis > Run workflow`. El
  workflow impide ejecuciones concurrentes, conserva la cache anterior si una
  consulta SQL falla y registra el resultado en `warmup:status` y
  `cache:last-warmup`.

  El repositorio externo del backend de Vercel no necesita copiar el workflow,
  pero debe aplicar la invalidacion de memoria descrita en
  `backend/VERCEL_BACKEND_SYNC.md` para detectar inmediatamente cada version.
