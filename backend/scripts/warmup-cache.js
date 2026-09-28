import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { Redis } from '@upstash/redis';

const REQUIRED_ENV = [
  'AZURE_SQL_SERVER',
  'AZURE_SQL_DATABASE',
  'AZURE_SQL_USER',
  'AZURE_SQL_PASSWORD',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  throw new Error(`Faltan variables requeridas: ${missingEnv.join(', ')}`);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const sqlConfig = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  connectionTimeout: 30_000,
  requestTimeout: 120_000,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
};

const runId = process.env.GITHUB_RUN_ID
  ? `github-${process.env.GITHUB_RUN_ID}`
  : `local-${randomUUID()}`;
const lockKey = 'warmup:lock';
const statusKey = 'warmup:status';
const lockTtlSeconds = 45 * 60;
const startedAt = new Date().toISOString();

let pool;
let ownsLock = false;

const rectoriaFilter = () => `
  LOWER(LTRIM(RTRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(
      CONVERT(NVARCHAR(200), [Rectoría] COLLATE Latin1_General_CI_AI),
    'á','a'),'é','e'),'í','i'),'ó','o')
  ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
`;

async function setJson(key, value) {
  await redis.set(key, JSON.stringify(value));
}

async function setStatus(status, extra = {}) {
  await setJson(statusKey, {
    status,
    runId,
    source: 'github-actions',
    reason: process.env.WARMUP_REASON || null,
    startedAt,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

async function acquireLock() {
  const result = await redis.set(lockKey, runId, {
    nx: true,
    ex: lockTtlSeconds,
  });
  if (result !== 'OK') {
    const currentOwner = await redis.get(lockKey);
    throw new Error(`Ya existe otro warmup en ejecucion (${currentOwner || 'desconocido'})`);
  }
  ownsLock = true;
}

async function releaseLock() {
  if (!ownsLock) return;
  const currentOwner = await redis.get(lockKey);
  if (currentOwner === runId) await redis.del(lockKey);
  ownsLock = false;
}

async function loadPopulation() {
  const resultYears = await pool.request().query(`
    SELECT DISTINCT [Año] AS year
    FROM Poblacion_Estudiantil2
    ORDER BY [Año]
  `);
  const years = resultYears.recordset.map((row) => String(row.year));
  if (years.length === 0) throw new Error('Azure SQL no devolvio anos de poblacion');

  const datasets = await Promise.all(years.map(async (year) => {
    console.log(`Consultando poblacion:${year}...`);
    const result = await pool.request()
      .input('year', sql.Int, Number(year))
      .query(`
        SELECT
          [Año] AS ano,
          [Modalidad] AS categoria,
          [Nivel Académico] AS nivelAcademico,
          [Nivel de Formación] AS nivelFormacion,
          [Facultad] AS facultad,
          [Centro Universitario] AS centro,
          [Centro de Operación] AS centroOperacion,
          [Programa Académico] AS programa,
          [Estudiantes Nuevos] AS nuevos,
          [Estudiantes Continuos] AS continuos,
          [Estudiantes Totales] AS totales,
          [Periodo] AS periodo,
          [Periodicidad] AS periodicidad,
          [Rectoría] AS rectoria,
          ISNULL([Ausentes (Periodo)], 0) AS ausentes,
          ISNULL([Desertores (Periodo)], 0) AS desertores,
          ISNULL([Tasa de Ausentismo (periodo)], 0) AS tasaAusentismo,
          ISNULL([Tasa Deserción (periodo)], 0) AS tasaDesercion
        FROM Poblacion_Estudiantil2
        WHERE [Año] = @year AND ${rectoriaFilter()}
      `);
    return [`poblacion:${year}`, result.recordset];
  }));

  return { years, datasets };
}

async function loadColaboradores() {
  return Promise.all(['2025-2', '2026-2'].map(async (periodo) => {
    console.log(`Consultando colaboradores:${periodo}...`);
    const result = await pool.request()
      .input('periodo', sql.NVarChar, periodo)
      .query(`
        SELECT
          [Modalidad] AS modalidad,
          [Género] AS genero,
          [Tipo de trabajador] AS tipo,
          [Máximo nivel de formación obtenido] AS nivelFormacion,
          [Dedicación] AS dedicacion,
          [Categoría en el escalafón docente] AS escalafon,
          [Tipo de contrato] AS tipoContrato,
          [Duración del contrato] AS duracionContrato,
          [Numero de trabajadores] AS total,
          [Periodo] AS periodo,
          [Rectoría] AS rectoria
        FROM Colaboradores
        WHERE
          LTRIM(RTRIM([Rectoría])) COLLATE Latin1_General_CI_AI IN (
            'bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.'
          )
          AND [Cursos Nacionales] <> 'Cursos Nacionales'
          AND [Periodo] = @periodo
      `);
    return [`colaboradores:${periodo}`, result.recordset];
  }));
}

async function loadOferta() {
  console.log('Consultando oferta:all...');
  const result = await pool.request().query(`
    SELECT
      [FACULTAD] AS facultad,
      [DENOMINACIÓN DEL PROGRAMA] AS denominacion,
      [NIVEL DE FORMACIÓN] AS nivelFormacion,
      [MODALIDAD] AS modalidad,
      [PERIODICIDAD DE ADMISIÓN] AS periodicidad,
      [DURACIÓN DEL PROGRAMA] AS duracion,
      [CRÉDITOS DEL PROGRAMA] AS creditos,
      [CUPOS] AS cupos,
      [ESTADO (activo - inactivo)] AS estado,
      [CÓDIGO SNIES] AS codigoSnies,
      [CODIGO BANNER] AS codigoBanner,
      [REGISTRO ÚNICO] AS registroUnico,
      [RESOLUCIÓN] AS resolucion,
      [RECTORÍA DUEÑA DEL PROGRAMA] AS rectoria,
      [DEPARTAMENTO (SEDE DEL PROGRAMA)] AS departamento,
      [MUNICIPIO (SEDE DEL PROGRAMA)] AS municipio,
      [COBERTURA DEL PROGRAMA] AS cobertura,
      [Tipo] AS tipo,
      [FECHA RESOLUCIÓN] AS fechaResolucion,
      [FECHA DE VENCIMIENTO] AS fechaVencimiento,
      [RESOLUCIÓN DE ACREDITACIÓN] AS resolucionAcreditacion,
      [FECHA ACREDITACIÓN] AS fechaAcreditacion,
      [VIGENCIA (AÑOS)] AS vigencia,
      [ACREDITADOS] AS acreditados
    FROM Oferta_Activa
    WHERE LOWER(LTRIM(RTRIM(
      REPLACE(REPLACE(REPLACE(REPLACE(
        CONVERT(NVARCHAR(200), [RECTORÍA DUEÑA DEL PROGRAMA] COLLATE Latin1_General_CI_AI),
      'á','a'),'é','e'),'í','i'),'ó','o')
    ))) IN (
      'bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.',
      'rectoria bogota, cundinamarca y boyaca'
    )
  `);
  return ['oferta:all', result.recordset];
}

async function loadComparativos() {
  console.log('Consultando comparativos:all...');
  const result = await pool.request().query(`
    SELECT
      [Año],
      [Modalidad],
      [Nivel Académico],
      [Nivel de Formación],
      [Periodo],
      [Centro Universitario],
      SUM([Estudiantes Totales]) AS total
    FROM [Poblacion_Estudiantil2]
    WHERE ${rectoriaFilter()}
      AND [Año] IN (2025, 2026)
      AND [Periodo] IN ('S2', 'Q3')
      AND LOWER(LTRIM(RTRIM(ISNULL(
        CONVERT(NVARCHAR(100), [Facultad] COLLATE Latin1_General_CI_AI), ''
      )))) <> 'febpe'
    GROUP BY
      [Año], [Modalidad], [Nivel Académico], [Nivel de Formación],
      [Periodo], [Centro Universitario]
  `);
  return ['comparativos:all', result.recordset];
}

async function loadTables() {
  console.log('Consultando tablas:all...');
  const result = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  return ['tablas:all', result.recordset];
}

async function main() {
  await acquireLock();
  await setStatus('running');

  console.log(`Warmup ${runId} iniciado`);
  pool = await sql.connect(sqlConfig);
  console.log('Conexion con Azure SQL establecida');

  // Primero se completan todas las consultas. Si alguna falla, Redis conserva
  // intacta la cache anterior.
  const population = await loadPopulation();
  const [colaboradores, oferta, comparativos, tables] = await Promise.all([
    loadColaboradores(),
    loadOferta(),
    loadComparativos(),
    loadTables(),
  ]);

  const datasets = [
    ...population.datasets,
    ...colaboradores,
    oferta,
    comparativos,
    tables,
  ];

  console.log(`Escribiendo ${datasets.length} conjuntos en Upstash...`);
  for (const [key, rows] of datasets) {
    await setJson(key, rows);
    console.log(`${key}: ${rows.length} filas`);
  }

  const completedAt = new Date().toISOString();
  const summary = Object.fromEntries(
    datasets.map(([key, rows]) => [key, rows.length])
  );
  await redis.set('cache:ready', JSON.stringify('true'));
  await setJson('cache:last-warmup', {
    runId,
    source: 'github-actions',
    reason: process.env.WARMUP_REASON || null,
    startedAt,
    completedAt,
    years: population.years,
    datasets: summary,
  });
  // Se escribe al final: los backends usan esta version para invalidar su
  // cache local solamente cuando todos los conjuntos ya estan disponibles.
  await redis.set('cache:version', runId);
  await setStatus('completed', { completedAt, datasets: summary });
  console.log('Cache actualizada correctamente');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Warmup fallido: ${message}`);
  if (ownsLock) {
    try {
      await setStatus('failed', { failedAt: new Date().toISOString(), error: message });
    } catch (statusError) {
      console.error('No fue posible registrar el estado fallido:', statusError);
    }
  }
  process.exitCode = 1;
} finally {
  if (pool) {
    try { await pool.close(); } catch {}
  }
  try { await releaseLock(); } catch (error) {
    console.error('No fue posible liberar el bloqueo:', error);
    process.exitCode = 1;
  }
}
