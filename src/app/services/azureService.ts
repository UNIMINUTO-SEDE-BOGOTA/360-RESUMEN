// src/services/azureService.ts

export interface DataItem {
  id: number;
  fecha: string;
  categoria: string;
  nivelAcademico: string;
  rectoria?: string;
  ceco?: string;
  snies?: string;
  centro?: string;
  sede?: string;
  centroOperacion?: string;
  facultad?: string;
  abreviatura?: string;
  siglasPrograma?: string;
  programa?: string;
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

// ==================== FETCH SEGURO ====================
// NUNCA lanza error ni reintenta — si no hay cache simplemente
// devuelve vacío. Azure SQL solo se enciende desde el botón Actualizar.

async function safeFetch(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });

    // Sin cache y BD apagada → vacío silencioso, NO reintentar
    if (res.status === 503) return null;

    if (!res.ok) return null;

    const payload = await res.json();
    return Array.isArray(payload) ? payload : (payload?.rows ?? []);
  } catch {
    return null;
  }
}

// ==================== FETCH BASE (combos) ====================
// Solo lee cache de Redis. Si no hay datos devuelve [].
// NUNCA despierta Azure.

export async function fetchAzureData(): Promise<DataItem[]> {
  const url = `${API_URL}/api/datos/${TABLE}?years=2020,2021,2022,2023,2024,2025,2026&page=1&pageSize=500000&_ts=${Date.now()}`;
  const raw = await safeFetch(url);
  if (!raw) return [];
  return raw.map(mapRow);
}

// ==================== FETCH TABLA (dashboard / pareto) ====================
// Igual: solo cache, nunca despierta Azure.

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
  const raw = await safeFetch(url);
  if (!raw) return { total: 0, rows: [] };

  return { total: raw.length, rows: raw.map(mapRow) };
}
