
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

  Las operaciones con efectos, como el warmup, se envian solo al principal.
