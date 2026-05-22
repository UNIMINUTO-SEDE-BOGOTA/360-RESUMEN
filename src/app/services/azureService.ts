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
  nivelesFormacion?: string[];   // ← agregar
  periodicidades?: string[];     // ← agregar
  facultades?: string[];        // ← agregar
  sedes?: string[];             // ← agregar
  page?: number;
  pageSize?: number;
}

const API_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  'http://localhost:3001';

const TABLE = encodeURIComponent('Poblacion_Estudiantil');

// ==================== HELPERS ====================

// Convierte array a CSV, devuelve undefined si está vacío
const toCsv = (arr?: string[]): string | undefined =>
  arr && arr.length
    ? arr.map(s => String(s).trim()).filter(Boolean).join(',')
    : undefined;

// Igual pero en mayúsculas (para períodos)
const toCsvUpper = (arr?: string[]): string | undefined =>
  arr && arr.length
    ? arr.map(s => String(s).trim().toUpperCase()).filter(Boolean).join(',')
    : undefined;

// Conversión numérica segura
const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const normalized = String(v).trim().replace(/\./g, '').replace(/,/g, '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

// Mapea una fila cruda de SQL a DataItem normalizado
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

// ==================== FETCH BASE (para combos) ====================
// Trae todos los años 2020–2026 explícitamente.
// Se usa solo para poblar los combos de filtros (modalidades, centros, etc.).
export async function fetchAzureData(): Promise<DataItem[]> {
  const res = await fetch(
    `${API_URL}/api/datos/${TABLE}?years=2020,2021,2022,2023,2024,2025,2026&page=1&pageSize=500000&_ts=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Error al obtener base de datos');
  const payload = await res.json();
  const raw = Array.isArray(payload) ? payload : (payload?.rows ?? []);
  return raw.map(mapRow);
}

// ==================== FETCH TABLA (para Pareto) ====================
// ✅ Los periodos que llegan aquí ya están descompuestos: ["S1","Q2"]
// NO llegan como "2026-S1" — eso lo hace parsedPeriodos en App.tsx.
export async function fetchTableMulti(
  f: FiltersMulti
): Promise<{ total: number; rows: DataItem[] }> {
  const qs = new URLSearchParams();

  // ✅ DESPUÉS — agregar nivelesFormacion y periodicidades
  const yearsCsv      = toCsv(f.years);
  const modsCsv       = toCsv(f.modalidades);
  const nivCsv        = toCsv(f.niveles);
  const perCsv        = toCsvUpper(f.periodos);
  const cenCsv        = toCsv(f.centros);
  const progCsv       = toCsv(f.programas);
  const nivFormCsv = toCsv(f.nivelesFormacion);
  const periodCsv  = toCsv(f.periodicidades);
  const facultadesCsv = toCsv(f.facultades);
  const sedesCsv      = toCsv(f.sedes);

  if (yearsCsv)    qs.set('years',           yearsCsv);
  if (modsCsv)     qs.set('modalidades',     modsCsv);
  if (nivCsv)      qs.set('niveles',         nivCsv);
  if (perCsv)      qs.set('periodos',        perCsv);
  if (cenCsv)      qs.set('centros',         cenCsv);
  if (progCsv)     qs.set('programas',       progCsv);
  if (nivFormCsv)  qs.set('nivelesFormacion', nivFormCsv);    // ← agregar
  if (periodCsv)   qs.set('periodicidades',  periodCsv);      // ← agregar
  if (facultadesCsv) qs.set('facultades',   facultadesCsv);  // ← agregar
  if (sedesCsv)      qs.set('sedes',        sedesCsv);       // ← agregar

  qs.set('page',     String(f.page     ?? 1));
  qs.set('pageSize', String(f.pageSize ?? 20000));
  qs.set('_ts',      String(Date.now()));

  const url = `${API_URL}/api/datos/${TABLE}?${qs.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error /api/datos: ${res.status}`);

  const payload = await res.json();
  const raw     = Array.isArray(payload) ? payload : (payload?.rows ?? []);
  const total   = Array.isArray(payload) ? raw.length : (payload?.total ?? raw.length);

  return { total, rows: raw.map(mapRow) };
}
