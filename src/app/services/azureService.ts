// src/services/azureService.ts

export interface DataItem {
  id: number;
  fecha: string;
  categoria: string;        // Modalidad
  nivelAcademico: string;   // Nivel
  rectoria?: string;
  ceco?: string;
  snies?: string;
  centro?: string;          // Centro Universitario
  sede?: string;
  centroOperacion?: string;
  facultad?: string;
  abreviatura?: string;
  siglasPrograma?: string;
  programa?: string;        // Programa Académico
  periodo?: string;
  periodicidad?: string;
  nuevos?: number;
  continuos?: number;
  totales?: number;
  graduados?: number;
  nivelFormacion?: string;
}

export interface FiltersMulti {
  years?: string[];
  modalidades?: string[];
  niveles?: string[];
  periodos?: string[];
  centros?: string[];
  programas?: string[];
  nivelesFormacion?: string[];
  periodicidades?: string[];
  facultades?: string[];
  sedes?: string[];
  page?: number;
  pageSize?: number;
}

const API_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  'https://three60-resumen-backend.onrender.com';

const TABLE = encodeURIComponent('Poblacion_Estudiantil');

// ==================== HELPERS ====================

const toCsv = (arr?: string[]): string | undefined =>
  arr && arr.length
    ? arr.map(s => String(s).trim()).filter(Boolean).join(',')
    : undefined;

const toCsvUpper = (arr?: string[]): string | undefined =>
  arr && arr.length
    ? arr.map(s => String(s).trim().toUpperCase()).filter(Boolean).join(',')
    : undefined;

const mapRow = (item: any, index: number): DataItem => ({
  id:              index,
  fecha:           String(item['Año'] ?? ''),
  categoria:       String(item['Modalidad'] ?? ''),
  nivelAcademico:  String(item['Nivel Académico'] ?? item['Nivel'] ?? ''),
  nivelFormacion:  item['Nivel de Formación'] ?? '',
  facultad:        item['Facultad'] ?? '',
  rectoria:        item['Rectoría'] ?? '',
  ceco:            item['CECO'] ?? '',
  snies:           item['SNIES'] ?? '',
  centro:          item['Centro Universitario'] ?? '',
  sede:            item['Sede'] ?? '',
  centroOperacion: item['Centro de Operación'] ?? '',
  abreviatura:     item['Abreviatura siglas'] ?? '',
  siglasPrograma:  item['Siglas Programa'] ?? '',
  programa:        item['Programa Académico'] ?? '',
  periodo:         String(item['Periodo'] ?? ''),
  periodicidad:    item['Periodicidad'] ?? '',
  nuevos:          Number(item['Estudiantes Nuevos']    ?? 0),
  continuos:       Number(item['Estudiantes Continuos'] ?? 0),
  totales:         Number(item['Estudiantes Totales']   ?? 0),
  graduados:       Number(item['Graduados'] ?? 0),
});

// ==================== WAIT FOR CACHE ====================
// Si el backend responde 503 con errorCode NO_DATA significa que Redis
// está vacío y la BD no está conectada. Espera hasta que haya datos.

async function waitForCache(
  maxWaitMs = 60_000,
  intervalMs = 2_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await fetch(`${API_URL}/api/cache/warmup-status`);
      if (r.ok) {
        const { done, entries } = await r.json();
        if (done && entries > 0) return; // cache listo
      }
    } catch {
      // backend aún arrancando, seguir esperando
    }
    await new Promise(res => setTimeout(res, intervalMs));
  }
  // Si se agotó el tiempo, continuar de todas formas
}

// ==================== FETCH CON REINTENTO ====================

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delayMs = 2_000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { cache: 'no-store' });

    if (res.ok) return res;

    if (res.status === 503) {
      let body: any = {};
      try { body = await res.clone().json(); } catch {}

      // Sin datos en cache ni BD → esperar warmup y reintentar
      if (body?.errorCode === 'NO_DATA') {
        console.warn(`⏳ Sin datos (intento ${attempt + 1}/${maxRetries + 1}), esperando cache...`);
        await waitForCache();
        continue;
      }

      // Azure pausado → no tiene sentido reintentar
      if (body?.errorCode === 'AZURE_SQL_PAUSED') {
        throw new Error(body.message ?? 'Azure SQL pausado');
      }
    }

    // Otros errores: reintentar con delay
    if (attempt < maxRetries) {
      console.warn(`⚠️ Error ${res.status}, reintentando en ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }

    throw new Error(`Error al obtener base de datos (${res.status})`);
  }

  throw new Error('No se pudo conectar al servidor');
}

// ==================== FETCH BASE (para combos) ====================

export async function fetchAzureData(): Promise<DataItem[]> {
  const url = `${API_URL}/api/datos/${TABLE}?years=2020,2021,2022,2023,2024,2025,2026&page=1&pageSize=500000&_ts=${Date.now()}`;
  const res = await fetchWithRetry(url);
  const payload = await res.json();
  const raw = Array.isArray(payload) ? payload : (payload?.rows ?? []);
  return raw.map(mapRow);
}

// ==================== FETCH TABLA (para dashboard y pareto) ====================

export async function fetchTableMulti(
  f: FiltersMulti
): Promise<{ total: number; rows: DataItem[] }> {
  const qs = new URLSearchParams();

  const yearsCsv      = toCsv(f.years);
  const modsCsv       = toCsv(f.modalidades);
  const nivCsv        = toCsv(f.niveles);
  const perCsv        = toCsvUpper(f.periodos);
  const cenCsv        = toCsv(f.centros);
  const progCsv       = toCsv(f.programas);
  const nivFormCsv    = toCsv(f.nivelesFormacion);
  const periodCsv     = toCsv(f.periodicidades);
  const facultadesCsv = toCsv(f.facultades);
  const sedesCsv      = toCsv(f.sedes);

  if (yearsCsv)      qs.set('years',           yearsCsv);
  if (modsCsv)       qs.set('modalidades',     modsCsv);
  if (nivCsv)        qs.set('niveles',         nivCsv);
  if (perCsv)        qs.set('periodos',        perCsv);
  if (cenCsv)        qs.set('centros',         cenCsv);
  if (progCsv)       qs.set('programas',       progCsv);
  if (nivFormCsv)    qs.set('nivelesFormacion', nivFormCsv);
  if (periodCsv)     qs.set('periodicidades',  periodCsv);
  if (facultadesCsv) qs.set('facultades',      facultadesCsv);
  if (sedesCsv)      qs.set('sedes',           sedesCsv);

  qs.set('page',     String(f.page     ?? 1));
  qs.set('pageSize', String(f.pageSize ?? 20000));
  qs.set('_ts',      String(Date.now()));

  const url = `${API_URL}/api/datos/${TABLE}?${qs.toString()}`;
  const res = await fetchWithRetry(url);

  const payload = await res.json();
  const raw     = Array.isArray(payload) ? payload : (payload?.rows ?? []);
  const total   = Array.isArray(payload) ? raw.length : (payload?.total ?? raw.length);

  return { total, rows: raw.map(mapRow) };
}
