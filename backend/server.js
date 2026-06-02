import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import { Redis } from '@upstash/redis';

console.log('✅ Servidor iniciando...');

const app = express();
app.use(cors());
app.use(express.json());
let ALLOW_DB = false;

// ==================== UPSTASH REDIS ====================
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache en memoria (capa rápida sobre Redis)
const memCache = new Map();
const MEM_TTL = 1000 * 60 * 60 * 24 * 30;

function getMemCache(key) {
  const item = memCache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > MEM_TTL) { memCache.delete(key); return null; }
  return item.data;
}

function setMemCache(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}

async function getCache(key) {
  const mem = getMemCache(key);
  if (mem !== null) return mem;
  try {
    const val = await redis.get(key);
    if (val !== null) {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      setMemCache(key, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('⚠️ Redis get error:', err.message);
  }
  return null;
}

async function setCache(key, data) {
  setMemCache(key, data);
  try {
    await redis.set(key, JSON.stringify(data));
    console.log(`🟣 Guardado en Redis: ${key}`);
  } catch (err) {
    console.warn('⚠️ Redis set error:', err.message);
  }
}

async function clearAllCache() {
  memCache.clear();
  try {
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i += 50) {
        await redis.del(...keys.slice(i, i + 50));
      }
    }
    console.log(`🗑️ Redis limpiado: ${keys.length} keys`);
  } catch (err) {
    console.warn('⚠️ Redis clear error:', err.message);
  }
}

async function loadCacheFromRedis() {
  try {
    const keys = await redis.keys('*');
    if (!keys.length) {
      console.log('ℹ️  Redis vacío. Usa el botón "Actualizar" para cargar datos.');
      return;
    }
    let loaded = 0;
    for (let i = 0; i < keys.length; i += 50) {
      const chunk = keys.slice(i, i + 50);
      const values = await redis.mget(...chunk);
      chunk.forEach((key, idx) => {
        if (values[idx] !== null) {
          setMemCache(key, values[idx]);
          loaded++;
        }
      });
    }
    console.log(`✅ Cache cargado desde Redis: ${loaded} entradas en memoria`);
  } catch (err) {
    console.warn('⚠️ No se pudo precargar desde Redis:', err.message);
  }
}

// ==================== AZURE SQL (solo para warmup) ====================
const config = {
  user:     process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server:   process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
let dbConnected = false;

async function connectDB() {
  try {
    if (pool) { try { await pool.close(); } catch {} }
    pool        = await sql.connect(config);
    dbConnected = true;
    console.log('✅ Conectado a Azure SQL Database');
  } catch (err) {
    dbConnected = false;
    console.error('❌ Error al conectar a Azure SQL:', getErrorMessage(err));
    throw err;
  }
}

function poolReady() {
  return ALLOW_DB && dbConnected && pool && pool.connected;
}

// ==================== HELPERS ====================
const normalize = (s = '') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function isPausedDbError(err) {
  const msg = (getErrorMessage(err) || '').toLowerCase();
  return (
    msg.includes('monthly free amount allowance') ||
    msg.includes('paused for the remainder of the month') ||
    msg.includes('continue using database with additional charges')
  );
}

function sendPaused(res) {
  return res.status(503).json({
    errorCode: 'AZURE_SQL_PAUSED',
    message:
      'La base de datos Azure SQL está pausada por haber alcanzado el límite gratuito del mes.',
    docs: 'https://go.microsoft.com/fwlink/?linkid=2243105&clcid=0x409',
  });
}

// 🔒 Respuesta estándar cuando un endpoint SOLO funciona en warmup
function sendCacheOnly(res, key) {
  return res.status(503).json({
    errorCode: 'CACHE_ONLY',
    message: `No hay datos en cache para "${key}". Usa el botón "Actualizar" para cargar.`,
    cached: false,
  });
}

function buildRectoriaFilter() {
  return `
    LOWER(LTRIM(RTRIM(
      REPLACE(REPLACE(REPLACE(REPLACE(
        CONVERT(NVARCHAR(200), [Rectoría] COLLATE Latin1_General_CI_AI),
      'á','a'),'é','e'),'í','i'),'ó','o')
    ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
  `;
}

// ==================== WARMUP ====================
const PORT = process.env.PORT || 3001;
let warmupDone = false;

async function warmupCacheDirect() {
  if (!poolReady()) {
    console.warn('⚠️ BD no disponible para warmup');
    return false;
  }

  console.log('🔥 Warmup MASIVO iniciando...');

  try {
    // ── 1. Años disponibles ──────────────────────────────────────────────────
    const resultYears = await pool.request().query(`
      SELECT DISTINCT [Año] as year FROM Poblacion_Estudiantil ORDER BY [Año]
    `);
    const years = resultYears.recordset.map(r => String(r.year));
    console.log('📊 Años encontrados:', years);

    // ── 2. Población por año (en paralelo) ──────────────────────────────────
    // ── 2. Población por año (en paralelo) ──────────────────────────────────
await Promise.all(years.map(async (year) => {
  try {
    const result = await pool.request()
      .input('year', sql.Int, Number(year))
      .query(`
        SELECT
          [Año]                    AS ano,
          [Modalidad]              AS categoria,
          [Nivel Académico]        AS nivelAcademico,
          [Nivel de Formación]     AS nivelFormacion,
          [Facultad]               AS facultad,
          [Centro Universitario]   AS centro,
          [Centro de Operación]    AS centroOperacion,
          [Programa Académico]     AS programa,
          [Estudiantes Nuevos]     AS nuevos,
          [Estudiantes Continuos]  AS continuos,
          [Estudiantes Totales]    AS totales,
          [Periodo]                AS periodo,
          [Periodicidad]           AS periodicidad,
          [Rectoría]               AS rectoria
        FROM Poblacion_Estudiantil
        WHERE [Año] = @year
          AND LOWER(LTRIM(RTRIM(
                REPLACE(REPLACE(REPLACE(REPLACE(
                  CONVERT(NVARCHAR(200), [Rectoría] COLLATE Latin1_General_CI_AI),
                'á','a'),'é','e'),'í','i'),'ó','o')
              ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
      `);

    await setCache(`poblacion:${year}`, result.recordset);
    console.log(`✅ poblacion:${year} → ${result.recordset.length} filas`);
  } catch (err) {
    console.error(`❌ Error cargando año ${year}:`, err.message);
  }
}));

    // ── 3. Colaboradores ────────────────────────────────────────────────────
    try {
      const r = await pool.request().query(`SELECT * FROM Colaboradores`);
      await setCache('colaboradores:all', r.recordset);
      console.log(`✅ colaboradores:all → ${r.recordset.length}`);
    } catch (e) { console.warn('⚠️ Error colaboradores:', e.message); }

    // ── 4. Oferta activa ────────────────────────────────────────────────────
    try {
      const r = await pool.request().query(`SELECT * FROM Oferta_Activa`);
      await setCache('oferta:all', r.recordset);
      console.log(`✅ oferta:all → ${r.recordset.length}`);
    } catch (e) { console.warn('⚠️ Error oferta:', e.message); }

    // ── 5. Comparativos ─────────────────────────────────────────────────────
    try {
      const filtroPeriodo = `
        (CASE
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'S1%' THEN 'S1'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'Q1%' THEN 'Q1'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE '%-1' THEN 'S1'
          ELSE ''
        END) IN ('S1','Q1')
      `;
      const r = await pool.request().query(`
        SELECT [Año], [Modalidad], [Nivel Académico], [Nivel de Formación],
               SUM([Estudiantes Totales]) AS total
        FROM [Poblacion_Estudiantil]
        WHERE ${buildRectoriaFilter()}
          AND [Año] IN (2025, 2026)
          AND ${filtroPeriodo}
        GROUP BY [Año], [Modalidad], [Nivel Académico], [Nivel de Formación]
      `);
      await setCache('comparativos:all', r.recordset);
      console.log(`✅ comparativos:all → ${r.recordset.length}`);
    } catch (e) { console.warn('⚠️ Error comparativos:', e.message); }

    // ── 6. Tablas disponibles ────────────────────────────────────────────────
    try {
      const r = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
      `);
      await setCache('tablas:all', r.recordset);
      console.log(`✅ tablas:all → ${r.recordset.length}`);
    } catch (e) { console.warn('⚠️ Error tablas:', e.message); }

    // ── 7. Marcar cache como listo ───────────────────────────────────────────
    await redis.set('cache:ready', 'true');
    console.log('✅ Cache completo cargado correctamente');
    return true;

  } catch (err) {
    console.error('❌ Error en warmup masivo:', err);
    return false;
  }
}

// ==================== ENDPOINTS ====================

// ── Cache: limpiar ──────────────────────────────────────────────────────────
app.post('/api/cache/clear', async (_req, res) => {
  await clearAllCache();
  res.json({ message: 'Cache limpiado (memoria + Redis)', entries: 0 });
});

// ── Cache: info ─────────────────────────────────────────────────────────────
app.get('/api/cache/info', async (_req, res) => {
  try {
    const keys = await redis.keys('*');
    res.json({ memEntries: memCache.size, redisEntries: keys.length, dbConnected });
  } catch (err) {
    res.json({ memEntries: memCache.size, redisEntries: 'error', error: err.message });
  }
});

// ── Cache: warmup status ────────────────────────────────────────────────────
app.get('/api/cache/warmup-status', (_req, res) => {
  res.json({ done: warmupDone, entries: memCache.size });
});

// ── Cache: warmup (ÚNICO punto que activa Azure) ────────────────────────────
app.post('/api/cache/warmup', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  res.json({ message: 'Warmup iniciado...', entries: memCache.size });

  try {
    ALLOW_DB = true;
    await connectDB();
    await clearAllCache();
    await redis.del('cache:ready');
    warmupDone = false;

    const ok = await warmupCacheDirect();
    warmupDone = ok;
  } catch (err) {
    console.error('❌ Error en warmup:', getErrorMessage(err));
  } finally {
    try { if (pool) { await pool.close(); console.log('🔌 Pool cerrado'); } } catch (e) {
      console.warn('⚠️ Error cerrando pool:', e.message);
    }
    dbConnected = false;
    ALLOW_DB    = false;
    console.log('✅ Azure SQL apagado después del warmup');
  }
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', connected: poolReady(), cache: memCache.size > 0 });
});

// ── Status ──────────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ paused: !poolReady(), connected: poolReady(), cache: memCache.size > 0 });
});

// ── Años disponibles (estático, sin DB) ────────────────────────────────────
app.get('/api/filtros/years', (_req, res) => {
  res.json(['2026', '2025', '2024', '2023', '2022', '2021', '2020']);
});

// ── Tablas: SOLO desde cache ─────────────────────────────────────────────────
app.get('/api/tablas', async (_req, res) => {
  const cached = await getCache('tablas:all');
  if (cached) return res.json(cached);
  return sendCacheOnly(res, 'tablas:all');
});

// ── Estructura: SOLO desde cache ─────────────────────────────────────────────
// (si quieres cachearla en warmup, agrégala; por ahora retorna 404 limpio)
app.get('/api/tablas/:nombre/estructura', async (req, res) => {
  const cached = await getCache(`estructura_${req.params.nombre}`);
  if (cached) return res.json(cached);
  return sendCacheOnly(res, `estructura_${req.params.nombre}`);
});

// ── Colaboradores: SOLO desde cache ──────────────────────────────────────────
app.get('/api/colaboradores', async (_req, res) => {
  const cached = await getCache('colaboradores:all');
  if (cached) return res.json(cached);
  return sendCacheOnly(res, 'colaboradores:all');
});

// ── Comparativos: SOLO desde cache ───────────────────────────────────────────
app.get('/api/comparativos', async (_req, res) => {
  const cached = await getCache('comparativos:all');
  if (cached) return res.json(cached);
  return sendCacheOnly(res, 'comparativos:all');
});

// ── Oferta activa: SOLO desde cache ──────────────────────────────────────────
app.get('/api/oferta-activa', async (_req, res) => {
  const cached = await getCache('oferta:all');
  if (cached) return res.json(cached);
  return sendCacheOnly(res, 'oferta:all');
});

// ── /api/datos/:tabla: SOLO cache ────────────────────────────────────────────
app.get('/api/datos/:tabla', async (req, res) => {
  const tabla = normalize(req.params.tabla);

  if (tabla !== 'poblacion_estudiantil') {
    return res.json({ rows: [] });
  }

  const ready = await redis.get('cache:ready');
  if (!ready) {
    return res.json({
      rows: [], loading: true, status: 'warming_up',
      message: 'Cache no cargado. Presione actualizar.',
    });
  }

  try {
    let years = (req.query.years || '').toString().split(',').filter(Boolean);
    if (years.length === 0) years = ['2026'];

    const keys = years.map(y => `poblacion:${y}`);
    let data = [];
    const missingKeys = [];

    // 1. Memoria primero
    keys.forEach(key => {
      const mem = getMemCache(key);
      if (mem) data.push(...mem);
      else missingKeys.push(key);
    });

    // 2. Redis para los que faltan
    if (missingKeys.length > 0) {
      const values = await redis.mget(...missingKeys);
      values.forEach((val, idx) => {
        if (val) {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          setMemCache(missingKeys[idx], parsed);
          data.push(...parsed);
        }
      });
    }

    return res.json({ rows: data, total: data.length, fromCache: true });
  } catch (err) {
    console.error('❌ Error leyendo cache:', err);
    return res.json({ rows: [], error: 'Error leyendo cache' });
  }
});

// ── /api/query: DESHABILITADO (usaría DB directamente) ───────────────────────
app.post('/api/query', (_req, res) => {
  return res.status(403).json({
    errorCode: 'DISABLED',
    message: 'Endpoint deshabilitado en modo cache-only. Disponible solo durante warmup.',
  });
});

// ==================== ERROR GLOBAL ====================
app.use((err, _req, res, _next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==================== KEEPALIVE ====================
function startKeepalive() {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/api/health`);
      console.log('💓 Keepalive OK');
    } catch (e) {
      console.warn('⚠️ Keepalive falló:', e.message);
    }
  }, 10 * 60 * 1000);
}

// ==================== INICIO ====================
await loadCacheFromRedis();

app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  console.log(`🟢 Modo cache-only activo — entradas en memoria: ${memCache.size}`);
  console.log(`ℹ️  Para recargar datos: POST /api/cache/warmup`);
  startKeepalive();
});

process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando servidor...');
  if (pool) { try { await pool.close(); } catch {} }
  process.exit(0);
});
