# Ajuste requerido en el backend externo de Vercel

El workflow de este repositorio escribe directamente en el Upstash compartido,
por lo que el backend de Vercel no necesita copiar el script de warmup. Si
mantiene una cache `Map` en memoria, si necesita reconocer `cache:version` para
no servir datos anteriores desde una instancia reutilizada.

Copiar al servidor del repositorio `PlaneacionProcesos/Backend_360_Resumen-V2`
la misma implementacion presente en `backend/server.js`:

1. Declarar `CACHE_VERSION_CHECK_MS`, `cacheVersion`,
   `cacheVersionInitialized` y `lastCacheVersionCheck` junto a `memCache`.
2. Copiar la funcion `syncCacheVersion()`.
3. Ejecutar `await syncCacheVersion()` al inicio de `getCache()`.

La comprobacion se limita a una vez cada 30 segundos por instancia. Cuando el
workflow termina, escribe `cache:version`; el siguiente acceso limpia el
`Map` local y vuelve a leer los conjuntos actualizados desde Redis.

Tambien se recomienda deshabilitar en ese repositorio los endpoints publicos
`POST /api/cache/warmup` y `POST /api/cache/clear`. El frontend ya no los usa y
la actualizacion oficial queda centralizada en GitHub Actions.
