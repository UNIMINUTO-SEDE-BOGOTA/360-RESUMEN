import 'dotenv/config';
import sql from 'mssql';
import { Redis } from '@upstash/redis';

console.log('='.repeat(60));
console.log('🔍 DIAGNÓSTICO DIRECTO DE BASE DE DATOS Y OFERTA ACTIVA');
console.log('='.repeat(60));

// 1. Verificar variables de entorno
console.log('\n--- 1. Variables de Entorno ---');
console.log('AZURE_SQL_SERVER:  ', process.env.AZURE_SQL_SERVER ? '✅ Definido' : '❌ Falta');
console.log('AZURE_SQL_DATABASE:', process.env.AZURE_SQL_DATABASE || '❌ Falta');
console.log('AZURE_SQL_USER:    ', process.env.AZURE_SQL_USER || '❌ Falta');
console.log('AZURE_SQL_PASSWORD:', process.env.AZURE_SQL_PASSWORD ? '✅ [Protegida]' : '❌ Falta');
console.log('UPSTASH_REDIS_URL: ', process.env.UPSTASH_REDIS_REST_URL ? '✅ Definido' : '⚠️ No definido');

const config = {
  user:     process.env.AZURE_SQL_USER,
  password: (process.env.AZURE_SQL_PASSWORD || '').replace(/^"|"$/g, ''),
  server:   process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    connectTimeout:         60000,
    requestTimeout:         60000,
  },
  pool: { max: 1, min: 0, idleTimeoutMillis: 10000 },
};

async function runDiagnostics() {
  // 1. Revisión Inmediata de Cache Redis
  console.log('\n--- 1. Verificando estado en Upstash Redis ---');
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (redisUrl.startsWith('https://') && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const cachedOferta = await redis.get('oferta:all');
      console.log('Valor crudo de oferta:all en Redis:', typeof cachedOferta, JSON.stringify(cachedOferta)?.slice(0, 200));
      if (cachedOferta) {
        const parsed = typeof cachedOferta === 'string' ? JSON.parse(cachedOferta) : cachedOferta;
        console.log(`Estado de 'oferta:all': Tipo=${typeof parsed}, EsArray=${Array.isArray(parsed)}, Longitud=${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
        if (Array.isArray(parsed) && parsed.length === 0) {
          console.warn('⚠️ ATENCIÓN: "oferta:all" está guardado en Redis pero es un ARREGLO VACÍO [].');
          console.warn('Esto explica por qué /api/oferta-activa responde [] inmediatamente.');
        }
      } else {
        console.warn(`⚠️ Cache 'oferta:all' en Redis: VACÍO o NULL.`);
      }

      const allKeys = await redis.keys('*');
      console.log(`Total de claves existentes en Redis: ${allKeys.length}`);
      console.log('Claves:', allKeys.join(', ') || 'Ninguna');
    } catch (errRedis) {
      console.warn('⚠️ Error al consultar Upstash Redis:', errRedis.message);
    }
  }

  let pool = null;

  // 2. Conexión Azure SQL
  console.log('\n--- 2. Probando conexión a Azure SQL (Timeout 60s) ---');
  try {
    console.log(`Intentando conectar a ${config.server} / ${config.database}...`);
    pool = await sql.connect(config);
    console.log('✅ Conexión exitosa a Azure SQL Database.');
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    if (err.message?.includes('Cannot open server') || err.message?.includes('Client with IP address')) {
      console.error('🔒 Posible bloqueo de Firewall en Azure: La IP local actual no está en la lista blanca de Azure SQL.');
    }
    if (err.message?.includes('paused')) {
      console.error('⏸️ La base de datos está pausada (límite de nivel gratuito o auto-pause).');
    }
    return;
  }

  try {
    // 3. Buscar tablas en la base de datos
    console.log('\n--- 3. Verificando tablas existentes en la Base de Datos ---');
    const tablesRes = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log(`Total de tablas encontradas: ${tablesRes.recordset.length}`);
    tablesRes.recordset.forEach(t => {
      const match = t.TABLE_NAME.toLowerCase().includes('oferta') ? ' ⭐ [COINCIDENCIA]' : '';
      console.log(`  - [${t.TABLE_SCHEMA}].[${t.TABLE_NAME}]${match}`);
    });

    const ofertaTable = tablesRes.recordset.find(t => 
      t.TABLE_NAME.toLowerCase() === 'oferta_activa' || t.TABLE_NAME.toLowerCase().includes('oferta')
    );

    if (!ofertaTable) {
      console.error('\n❌ No se encontró ninguna tabla similar a "Oferta_Activa".');
      return;
    }

    const actualTableName = ofertaTable.TABLE_NAME;
    console.log(`\n✅ Tabla detectada para pruebas: [${actualTableName}]`);

    // 4. Estructura y Columnas
    console.log(`\n--- 4. Estructura de columnas de [${actualTableName}] ---`);
    const colsRes = await pool.request()
      .input('tableName', sql.NVarChar, actualTableName)
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);
    
    console.log(`Columnas encontradas (${colsRes.recordset.length}):`);
    colsRes.recordset.forEach(c => {
      console.log(`  • ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''})`);
    });

    // 5. Conteo Total de Filas
    console.log(`\n--- 5. Conteo de filas en [${actualTableName}] ---`);
    const countRes = await pool.request().query(`SELECT COUNT(*) AS total FROM [${actualTableName}]`);
    const totalFilas = countRes.recordset[0].total;
    console.log(`Total filas en la tabla (sin filtros): ${totalFilas}`);

    if (totalFilas === 0) {
      console.warn('⚠️ La tabla está completamente VACÍA en Azure SQL.');
    } else {
      // 6. Muestra de primeros registros
      console.log(`\n--- 6. Muestra de los primeros 2 registros (sin filtros) ---`);
      const sampleRes = await pool.request().query(`SELECT TOP 2 * FROM [${actualTableName}]`);
      console.dir(sampleRes.recordset, { depth: null, colors: true });

      // 7. Analizar posibles columnas de Rectoría / Sede
      console.log(`\n--- 7. Revisando valores únicos de Rectoría / Sede / Depto / Municipio ---`);
      const distinctRes = await pool.request().query(`
        SELECT 
          [RECTORÍA DUEÑA DEL PROGRAMA]       AS rectoria,
          [DEPARTAMENTO (SEDE DEL PROGRAMA)]  AS depto,
          [MUNICIPIO (SEDE DEL PROGRAMA)]     AS municipio,
          COUNT(*)                            AS cantidad
        FROM [${actualTableName}]
        GROUP BY 
          [RECTORÍA DUEÑA DEL PROGRAMA],
          [DEPARTAMENTO (SEDE DEL PROGRAMA)],
          [MUNICIPIO (SEDE DEL PROGRAMA)]
        ORDER BY cantidad DESC
      `);
      console.log('Combinaciones encontradas:');
      distinctRes.recordset.forEach(r => {
        console.log(`  - Rectoría: "${r.rectoria}" | Depto: "${r.depto}" | Mun: "${r.municipio}" → ${r.cantidad} registros`);
      });

      // 8. Probar la consulta exacta de server.js
      console.log(`\n--- 8. Probando la consulta actual de server.js ---`);
      try {
        const queryServer = `
          SELECT
            [FACULTAD]                           AS facultad,
            [DENOMINACIÓN DEL PROGRAMA]          AS denominacion,
            [NIVEL DE FORMACIÓN]                 AS nivelFormacion,
            [MODALIDAD]                          AS modalidad,
            [PERIODICIDAD DE ADMISIÓN]           AS periodicidad,
            [DURACIÓN DEL PROGRAMA]              AS duracion,
            [CRÉDITOS DEL PROGRAMA]              AS creditos,
            [CUPOS]                              AS cupos,
            [ESTADO (activo - inactivo)]         AS estado,
            [CÓDIGO SNIES]                       AS codigoSnies,
            [CODIGO BANNER]                      AS codigoBanner,
            [REGISTRO ÚNICO]                     AS registroUnico,
            [RESOLUCIÓN]                         AS resolucion,
            [RECTORÍA DUEÑA DEL PROGRAMA]        AS rectoria,
            [DEPARTAMENTO (SEDE DEL PROGRAMA)]   AS departamento,
            [MUNICIPIO (SEDE DEL PROGRAMA)]      AS municipio,
            [COBERTURA DEL PROGRAMA]             AS cobertura,
            [Tipo]                               AS tipo,
            [FECHA RESOLUCIÓN]                   AS fechaResolucion,
            [FECHA DE VENCIMIENTO]               AS fechaVencimiento,
            [RESOLUCIÓN DE ACREDITACIÓN]         AS resolucionAcreditacion,
            [FECHA ACREDITACIÓN]                 AS fechaAcreditacion,
            [VIGENCIA (AÑOS)]                    AS vigencia,
            [ACREDITADOS]                        AS acreditados
          FROM [${actualTableName}]
          WHERE LOWER(LTRIM(RTRIM(
            REPLACE(REPLACE(REPLACE(REPLACE(
              CONVERT(NVARCHAR(200), [RECTORÍA DUEÑA DEL PROGRAMA] COLLATE Latin1_General_CI_AI),
            'á','a'),'é','e'),'í','i'),'ó','o')
          ))) IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.')
        `;
        const testServerRes = await pool.request().query(queryServer);
        console.log(`📊 Filas con filtro actual de server.js: ${testServerRes.recordset.length}`);
        if (testServerRes.recordset.length === 0) {
          console.error(`❌ CAUSA DEL PROBLEMA: La cláusula WHERE filtra exactamente por IN ('bogota', 'sede bogota', 'rectoria bogota', 'bogota d.c.').`);
          console.error(`   Pero en la base de datos el valor es: "Rectoría Bogotá, Cundinamarca y Boyacá"!`);
        }
      } catch (errQuery) {
        console.error(`❌ Error al ejecutar la consulta de server.js:`, errQuery.message);
      }

      // 8b. Probar consulta corregida (buscando 'bogota' o incluyendo la rectoría completa)
      console.log(`\n--- 8b. Probando consulta CORREGIDA ---`);
      try {
        const queryFix = `
          SELECT
            [FACULTAD]                           AS facultad,
            [DENOMINACIÓN DEL PROGRAMA]          AS denominacion,
            [NIVEL DE FORMACIÓN]                 AS nivelFormacion,
            [MODALIDAD]                          AS modalidad,
            [PERIODICIDAD DE ADMISIÓN]           AS periodicidad,
            [DURACIÓN DEL PROGRAMA]              AS duracion,
            [CRÉDITOS DEL PROGRAMA]              AS creditos,
            [CUPOS]                              AS cupos,
            [ESTADO (activo - inactivo)]         AS estado,
            [CÓDIGO SNIES]                       AS codigoSnies,
            [CODIGO BANNER]                      AS codigoBanner,
            [REGISTRO ÚNICO]                     AS registroUnico,
            [RESOLUCIÓN]                         AS resolucion,
            [RECTORÍA DUEÑA DEL PROGRAMA]        AS rectoria,
            [DEPARTAMENTO (SEDE DEL PROGRAMA)]   AS departamento,
            [MUNICIPIO (SEDE DEL PROGRAMA)]      AS municipio,
            [COBERTURA DEL PROGRAMA]             AS cobertura,
            [Tipo]                               AS tipo,
            [FECHA RESOLUCIÓN]                   AS fechaResolucion,
            [FECHA DE VENCIMIENTO]               AS fechaVencimiento,
            [RESOLUCIÓN DE ACREDITACIÓN]         AS resolucionAcreditacion,
            [FECHA ACREDITACIÓN]                 AS fechaAcreditacion,
            [VIGENCIA (AÑOS)]                    AS vigencia,
            [ACREDITADOS]                        AS acreditados
          FROM [${actualTableName}]
          WHERE LOWER(LTRIM(RTRIM(
            REPLACE(REPLACE(REPLACE(REPLACE(
              CONVERT(NVARCHAR(200), [RECTORÍA DUEÑA DEL PROGRAMA] COLLATE Latin1_General_CI_AI),
            'á','a'),'é','e'),'í','i'),'ó','o')
          ))) LIKE '%bogota%'
        `;
        const testFixRes = await pool.request().query(queryFix);
        console.log(`✅ Filas con consulta corregida (LIKE '%bogota%'): ${testFixRes.recordset.length}`);
        if (testFixRes.recordset.length > 0) {
          console.log(`Muestra de primer resultado corregido:`);
          console.log(`  - Facultad: ${testFixRes.recordset[0].facultad}`);
          console.log(`  - Denominación: ${testFixRes.recordset[0].denominacion}`);
          console.log(`  - Nivel: ${testFixRes.recordset[0].nivelFormacion}`);
          console.log(`  - Modalidad: ${testFixRes.recordset[0].modalidad}`);
          console.log(`  - Estado: ${testFixRes.recordset[0].estado}`);
        }
      } catch (errQuery) {
        console.error(`❌ Error al ejecutar la consulta corregida:`, errQuery.message);
      }
    }

  } catch (err) {
    console.error('❌ Error durante el diagnóstico SQL:', err);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Conexión SQL cerrada.');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 FIN DEL DIAGNÓSTICO');
  console.log('='.repeat(60));
}

runDiagnostics();
