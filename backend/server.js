// server.js
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import sql from 'mssql';

console.log('✅ Azure SQL activo');
const app = express();

app.use(cors());
app.use(express.json());

// ==================== CONFIGURACIÓN AZURE SQL ====================

const config = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

async function connectDB() {
  try {
    pool = await sql.connect(config);
    console.log('✅ Conectado exitosamente a Azure SQL Database');
    console.log(`   Servidor: ${config.server}`);
    console.log(`   Base de datos: ${config.database}`);
  } catch (err) {
    console.error('❌ Error al conectar a Azure SQL:', getErrorMessage(err));
    process.exit(1);
  }
}

// ==================== HELPERS ====================

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

const normalize = (s = '') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const findColumn = (cols, ...names) =>
  cols.find(c => names.some(name => normalize(c) === normalize(name)));

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

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
      'La base de datos Azure SQL está pausada por haber alcanzado el límite gratuito del mes. ' +
      'Puedes reanudarla en Azure Portal: SQL Database → Compute + storage → "Continue using database with additional charges". ' +
      'Se reanudará automáticamente el 01 del próximo mes (00:00 UTC).',
    docs: 'https://go.microsoft.com/fwlink/?linkid=2243105&clcid=0x409',
  });
}

// Filtro de Rectoría tolerante a tildes y variantes (usa literales, no parámetros SQL)
function buildRectoriaFilter() {
  return `
    LOWER(LTRIM(RTRIM(
      REPLACE(REPLACE(REPLACE(REPLACE(
        CONVERT(NVARCHAR(200), [Rectoría] COLLATE Latin1_General_CI_AI),
      'á','a'),'é','e'),'í','i'),'ó','o')
    ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
  `;
}

// ==================== ENDPOINTS ====================

// Limpiar cache manualmente
app.post('/api/cache/clear', (_req, res) => {
  cache.clear();
  res.json({ message: 'Cache limpiado correctamente' });
});

// Salud rápida
app.get('/api/health', async (_req, res) => {
  try {
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', connected: true, source: 'AZURE' });
  } catch (err) {
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

// Status amigable
app.get('/api/status', async (_req, res) => {
  try {
    const r = await pool.request().query('SELECT DB_NAME() AS db, SYSDATETIMEOFFSET() AS now');
    res.json({ paused: false, source: 'AZURE', info: r.recordset?.[0] });
  } catch (err) {
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ paused: null, error: getErrorMessage(err) });
  }
});

// Tablas
app.get('/api/tablas', async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
    `);
    res.json(result.recordset);
  } catch (err) {
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

// Estructura de tabla
app.get('/api/tablas/:nombre/estructura', async (req, res) => {
  try {
    const { nombre } = req.params;
    const result = await pool.request()
      .input('tableName', sql.NVarChar, nombre)
      .query(`
        SELECT COLUMN_NAME as columna, DATA_TYPE as tipo,
               IS_NULLABLE as nullable, CHARACTER_MAXIMUM_LENGTH as longitud
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName ORDER BY ORDINAL_POSITION
      `);
    res.json(result.recordset);
  } catch (err) {
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

// Años disponibles — siempre fijos 2020–2026
app.get('/api/filtros/years', (_req, res) => {
  res.json(['2026', '2025', '2024', '2023', '2022', '2021', '2020']);
});

// ===================== /api/colaboradores =====================
app.get('/api/colaboradores', async (req, res) => {
  try {
    const where = [];
    const r = pool.request();

    // Filtro Rectoría (OJO: columna real)
    where.push(`
      LOWER(LTRIM(RTRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(
          CONVERT(NVARCHAR(200), [Rectoría] COLLATE Latin1_General_CI_AI),
        'á','a'),'é','e'),'í','i'),'ó','o')
      ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
    `);

    // Periodo (columna real)
    if (req.query.periodo) {
      r.input('periodo', sql.NVarChar, req.query.periodo);
      where.push(`[Periodo] = @periodo`);
    }

    const sqlQuery = `
      SELECT
        [Modalidad]                          AS modalidad,
        [Género]                             AS genero,
        [Tipo de trabajador]                 AS tipo,
        [Máximo nivel de formación obtenido] AS nivelFormacion,
        [Dedicación]                         AS dedicacion,
        [Categoría en el escalafón docente]  AS escalafon,
        [Tipo de contrato]                   AS tipoContrato,
        [Duración del contrato]              AS duracionContrato,
        [Numero de trabajadores]                AS total
      FROM Colaboradores
      WHERE ${where.join(" AND ")}
    `;

    const result = await r.query(sqlQuery);
    res.json(result.recordset);

  } catch (err) {
    console.error("❌ Error /api/colaboradores:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== /api/comparativos =====================

app.get('/api/comparativos', async (req, res) => {
  try {

    const tableName = "Poblacion_Estudiantil"; // 👈 cambia si el nombre real es otro

    const filtroPeriodo = `
      (CASE
        WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'S1%'  THEN 'S1'
        WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'Q1%'  THEN 'Q1'
        WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE '%-1'  THEN 'S1'
        ELSE ''
      END) IN ('S1','Q1')
    `;

    const query = `
      SELECT
        [Año],
        [Modalidad],
        [Nivel Académico],
        [Nivel de Formación],
        SUM([Estudiantes Totales]) AS total
      FROM [${tableName}]
      WHERE ${buildRectoriaFilter()}
        AND [Año] IN (2025, 2026)
        AND ${filtroPeriodo}
      GROUP BY
        [Año],
        [Modalidad],
        [Nivel Académico],
        [Nivel de Formación]
    `;

    const result = await pool.request().query(query);

    console.log("✅ comparativos rows:", result.recordset.length);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ Error comparativos:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== /api/oferta-activa =====================
app.get('/api/oferta-activa', async (req, res) => {
  try {
    const where = [];
    const r = pool.request();

    // Filtro Rectoría Bogotá
    where.push(`
      LOWER(LTRIM(RTRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(
          CONVERT(NVARCHAR(200), [RECTORÍA DUEÑA DEL PROGRAMA] COLLATE Latin1_General_CI_AI),
        'á','a'),'é','e'),'í','i'),'ó','o')
      ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
    `);

    // Filtro estado activo (opcional, por defecto solo activos)
    const soloActivos = req.query.estado !== 'todos';
    if (soloActivos) {
      where.push(`
        LOWER(LTRIM(RTRIM(
          CONVERT(NVARCHAR(50), [ESTADO (activo - inactivo)] COLLATE Latin1_General_CI_AI)
        ))) = 'activo'
      `);
    }

    // Filtro modalidad opcional
    if (req.query.modalidad) {
      r.input('modalidad', sql.NVarChar, req.query.modalidad);
      where.push(`[MODALIDAD] COLLATE Latin1_General_CI_AI = @modalidad COLLATE Latin1_General_CI_AI`);
    }

    // Filtro nivel de formación opcional
    if (req.query.nivel) {
      r.input('nivel', sql.NVarChar, req.query.nivel);
      where.push(`[NIVEL DE FORMACIÓN] COLLATE Latin1_General_CI_AI = @nivel COLLATE Latin1_General_CI_AI`);
    }

    const sqlQuery = `
      SELECT
        [FACULTAD]                        AS facultad,
        [REGISTRO ÚNICO]                  AS registroUnico,
        [RESOLUCIÓN]                      AS resolucion,
        [CÓDIGO SNIES]                    AS codigoSnies,
        [CODIGO BANNER]                   AS codigoBanner,
        [DENOMINACIÓN DEL PROGRAMA]       AS denominacion,
        [NIVEL DE FORMACIÓN]              AS nivelFormacion,
        [MODALIDAD]                       AS modalidad,
        [PERIODICIDAD DE ADMISIÓN]        AS periodicidad,
        [DURACIÓN DEL PROGRAMA]           AS duracion,
        [CRÉDITOS DEL PROGRAMA]           AS creditos,
        [CUPOS]                           AS cupos,
        [RECTORÍA DUEÑA DEL PROGRAMA]     AS rectoria,
        [DEPARTAMENTO (SEDE DEL PROGRAMA)] AS departamento,
        [MUNICIPIO (SEDE DEL PROGRAMA)]   AS municipio,
        [COBERTURA DEL PROGRAMA]          AS cobertura,
        [Tipo]                            AS tipo,
        [ESTADO (activo - inactivo)]      AS estado,
        [FECHA RESOLUCIÓN]                AS fechaResolucion,
        [FECHA DE VENCIMIENTO]            AS fechaVencimiento,
        [RESOLUCIÓN DE ACREDITACIÓN]      AS resolucionAcreditacion,
        [FECHA ACREDITACIÓN]              AS fechaAcreditacion,
        [VIGENCIA (AÑOS)]                 AS vigencia,
        [ACREDITADOS]                     AS acreditados
      FROM [Oferta_Activa]
      WHERE ${where.join(' AND ')}
      ORDER BY [NIVEL DE FORMACIÓN], [MODALIDAD], [DENOMINACIÓN DEL PROGRAMA]
    `;

    const result = await r.query(sqlQuery);

    console.log('✅ oferta-activa rows:', result.recordset.length);
    res.json(result.recordset);

  } catch (err) {
    console.error('❌ Error /api/oferta-activa:', err);
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});


// ===================== /api/datos/:tabla =====================
app.get('/api/datos/:tabla', async (req, res) => {
  try {
    const AI       = 'Latin1_General_CI_AI';
    const rawTabla = req.params.tabla;

    const page     = Math.max(1, Number(req.query.page)     || 1);
    const pageSize = Math.min(10000, Math.max(100, Number(req.query.pageSize) || 1000));
    const offset   = (page - 1) * pageSize;

    const yearsCSV            = (req.query.years            ?? '').toString();
    const modalidadesCSV      = (req.query.modalidades      ?? '').toString();
    const nivelesCSV          = (req.query.niveles          ?? '').toString();
    const periodosCSV         = (req.query.periodos         ?? '').toString();
    const centrosCSV          = (req.query.centros          ?? '').toString();
    const nivelesFormacionCSV = (req.query.nivelesFormacion ?? '').toString();
    const periodicidadesCSV = (req.query.periodicidades ?? '').toString();
    const programasCSV = (req.query.programas ?? '').toString();
    const facultadesCSV = (req.query.facultades ?? '').toString();
    const sedesCSV      = (req.query.sedes      ?? '').toString();



    // Resolver nombre real de tabla
    const validTables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    let realTableName = null;
    for (const row of validTables.recordset) {
      if (normalize(row.TABLE_NAME) === normalize(rawTabla)) {
        realTableName = row.TABLE_NAME;
        break;
      }
    }
    if (!realTableName) {
      return res.status(404).json({ error: 'Tabla no encontrada', solicitada: rawTabla });
    }

    // Columnas
    const cols = await pool.request()
      .input('t', sql.NVarChar, realTableName)
      .query(`
        SELECT COLUMN_NAME, ORDINAL_POSITION FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION
      `);
    const colNames          = cols.recordset.map(r => r.COLUMN_NAME);
    const nivelCol          = findColumn(colNames, 'Nivel Académico');
    const nivelFormacionCol = findColumn(colNames, 'Nivel de Formación', 'Nivel Formacion');
    const periodicidadCol = findColumn(colNames, 'Periodicidad');
    const facultadCol = findColumn(colNames, 'Facultad');
    const sedesCol  = findColumn(colNames, 'Sede');
    const programaCol = findColumn(
        colNames,
        'Programa Académico',
        'Programa',
        'ProgramaAcademico'
      );
    const hasAnyo           = colNames.some(c => c.toLowerCase() === 'año' || c.toLowerCase() === 'ano');
    const orderByClause     = hasAnyo ? 'ORDER BY [Año] DESC' : `ORDER BY [${cols.recordset[0]?.COLUMN_NAME || '1'}]`;

    // WHERE dinámico
    const where    = [];
    const reqData  = pool.request();
    const reqCount = pool.request();

    // Filtro Rectoría (literales, sin parámetro)
    where.push(buildRectoriaFilter());

    // Años
    if (yearsCSV) {
      reqData.input('years', sql.NVarChar, yearsCSV);
      reqCount.input('years', sql.NVarChar, yearsCSV);
      where.push(`[Año] IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@years, ','))`);
    } else {
      where.push(`[Año] BETWEEN 2020 AND 2026`);
    }
        // Periodicidades
    if (periodicidadesCSV && periodicidadCol) {
      reqData.input('perio', sql.NVarChar, periodicidadesCSV);
      reqCount.input('perio', sql.NVarChar, periodicidadesCSV);

      where.push(`
        LOWER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [${periodicidadCol}] COLLATE Latin1_General_CI_AI))))
        IN (
          SELECT LOWER(LTRIM(RTRIM(value))) 
          FROM STRING_SPLIT(@perio, ',')
        )
      `);
    }
          // Facultades
      if (facultadesCSV && facultadCol) {
        reqData.input('facs', sql.NVarChar, facultadesCSV);
        reqCount.input('facs', sql.NVarChar, facultadesCSV);
        where.push(`
          [${facultadCol}] COLLATE ${AI} 
          IN (SELECT value COLLATE ${AI} FROM STRING_SPLIT(@facs, ','))
        `);
      }

      // Sedes (Rectoría)
    // ✅ DESPUÉS
    const rectoriaCo = findColumn(colNames, 'Rectoría', 'Rectoria', 'Sede');

    if (sedesCSV && rectoriaCo) {
      reqData.input('sedes', sql.NVarChar, sedesCSV);
      reqCount.input('sedes', sql.NVarChar, sedesCSV);
      where.push(`
        [${rectoriaCo}] COLLATE ${AI}
        IN (SELECT value COLLATE ${AI} FROM STRING_SPLIT(@sedes, ','))
      `);
    }

    if (programasCSV && programaCol) {
      reqData.input('progs', sql.NVarChar, programasCSV);
      reqCount.input('progs', sql.NVarChar, programasCSV);

      where.push(`
        [${programaCol}] COLLATE Latin1_General_CI_AI
        IN (SELECT value COLLATE Latin1_General_CI_AI FROM STRING_SPLIT(@progs, ','))
      `);
    }

    // Modalidades
    if (modalidadesCSV) {
      reqData.input('mods', sql.NVarChar, modalidadesCSV);
      reqCount.input('mods', sql.NVarChar, modalidadesCSV);
      where.push(`[Modalidad] COLLATE ${AI} IN (SELECT value COLLATE ${AI} FROM STRING_SPLIT(@mods, ','))`);
    }

    // Niveles académicos
    if (nivelesCSV && nivelCol) {
      reqData.input('niv', sql.NVarChar, nivelesCSV);
      reqCount.input('niv', sql.NVarChar, nivelesCSV);
      where.push(`
        LOWER(LTRIM(RTRIM(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            CONVERT(NVARCHAR(100), [${nivelCol}] COLLATE Latin1_General_CI_AI),
          'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u')
        )))
        IN (
          SELECT LOWER(LTRIM(RTRIM(
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(value,
            'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u')
          )))
          FROM STRING_SPLIT(@niv, ',')
        )
      `);
    }
    // Nivel de formación
    if (nivelesFormacionCSV && nivelFormacionCol) {
      reqData.input('nivForm', sql.NVarChar, nivelesFormacionCSV);
      reqCount.input('nivForm', sql.NVarChar, nivelesFormacionCSV);
      where.push(`[${nivelFormacionCol}] COLLATE ${AI} IN (SELECT value COLLATE ${AI} FROM STRING_SPLIT(@nivForm, ','))`);
    }

    // Centros universitarios
    if (centrosCSV) {
      reqData.input('cts', sql.NVarChar, centrosCSV);
      reqCount.input('cts', sql.NVarChar, centrosCSV);
      where.push(`[Centro Universitario] COLLATE ${AI} IN (SELECT value COLLATE ${AI} FROM STRING_SPLIT(@cts, ','))`);
    }

    // Periodos
    if (periodosCSV) {
      reqData.input('pers', sql.NVarChar, periodosCSV.toUpperCase());
      reqCount.input('pers', sql.NVarChar, periodosCSV.toUpperCase());
      where.push(`
        (CASE
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'S1%'  THEN 'S1'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'S2%'  THEN 'S2'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'Q1%'  THEN 'Q1'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'Q2%'  THEN 'Q2'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE 'Q3%'  THEN 'Q3'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE '%-1'  THEN 'S1'
          WHEN REPLACE(UPPER(CONVERT(NVARCHAR(30), [Periodo])), ' ', '') LIKE '%-2'  THEN 'S2'
          ELSE ''
        END) IN (SELECT UPPER(LTRIM(RTRIM(value))) FROM STRING_SPLIT(@pers, ','))
      `);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql  = `
          SELECT
      [Año],
      [Modalidad],
      [Nivel Académico],
      [Nivel de Formación],
      [Facultad],
      [Centro Universitario],
      [Centro de Operación],
      [Programa Académico],
      [Estudiantes Nuevos],
      [Estudiantes Continuos],
      [Estudiantes Totales],
      [Periodo],
      [Periodicidad],
      [Rectoría]
    FROM [${realTableName}] ${whereSql}
      ${orderByClause}
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
    `;
    const countSql = `SELECT COUNT(*) AS total FROM [${realTableName}] ${whereSql}`;

    const [dataR, countR] = await Promise.all([
      reqData.query(dataSql),
      reqCount.query(countSql),
    ]);

    res.json({
      page,
      pageSize,
      total: countR.recordset[0]?.total || 0,
      rows:  dataR.recordset,
    });

  } catch (err) {
    console.error('❌ Error /api/datos:', err);
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

// Ejecutar SELECT custom
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!/^\s*select\b/i.test(query)) {
      return res.status(403).json({ error: 'Solo se permiten consultas SELECT' });
    }
    const r = await pool.request().query(query);
    res.json(r.recordset);
  } catch (err) {
    if (isPausedDbError(err)) return sendPaused(res);
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

// ==================== ERROR GLOBAL ====================

app.use((err, _req, res, _next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==================== INICIO ====================

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  try { await connectDB(); }
  catch (err) { console.error('Error conectando DB:', err); }
});

process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando servidor...');
  if (pool) { try { await pool.close(); } catch {} }
  process.exit(0);
});