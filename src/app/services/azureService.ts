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
  fecha:           String(item.ano ?? item['Año'] ?? ''),
  categoria:       String(item.categoria ?? item['Modalidad'] ?? ''),
  nivelAcademico:  String(item.nivelAcademico ?? item['Nivel Académico'] ?? ''),
  nivelFormacion:  item.nivelFormacion ?? item['Nivel de Formación'] ?? '',
  facultad:        item.facultad ?? item['Facultad'] ?? '',
  rectoria:        item.rectoria ?? item['Rectoría'] ?? '',
  ceco:            item.ceco ?? item['CECO'] ?? '',
  snies:           item.snies ?? item['SNIES'] ?? '',
  centro:          item.centro ?? item['Centro Universitario'] ?? '',
  sede:            item.sede ?? item['Sede'] ?? '',
  centroOperacion: item.centroOperacion ?? item['Centro de Operación'] ?? '',
  abreviatura:     item.abreviatura ?? item['Abreviatura siglas'] ?? '',
  siglasPrograma:  item.siglasPrograma ?? item['Siglas Programa'] ?? '',
  programa:        item.programa ?? item['Programa Académico'] ?? '',
  periodo:         String(item.periodo ?? item['Periodo'] ?? ''),
  periodicidad:    item.periodicidad ?? item['Periodicidad'] ?? '',
  nuevos:          Number(item.nuevos    ?? item['Estudiantes Nuevos']    ?? 0),
  continuos:       Number(item.continuos ?? item['Estudiantes Continuos'] ?? 0),
  totales:         Number(item.totales   ?? item['Estudiantes Totales']   ?? 0),
  graduados:       Number(item.graduados ?? item['Graduados'] ?? 0),
});

const normalizeNivel = (nivel: string): string => {
  const n = (nivel ?? '').toLowerCase().trim();
  if (n.includes('posgrado') || n.includes('especial') ||
      n.includes('maestr') || n.includes('doctor')) return 'Posgrado';
  return 'Pregrado';
};

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

  const yearsCsv = toCsv(f.years);
  if (yearsCsv) qs.set('years', yearsCsv);
  qs.set('page',     String(f.page     ?? 1));
  qs.set('pageSize', String(f.pageSize ?? 20000));
  qs.set('_ts',      String(Date.now()));

  const url = `${API_URL}/api/datos/${TABLE}?${qs.toString()}`;
  const raw = await safeFetch(url);
  if (!raw) return { total: 0, rows: [] };

  let rows = raw.map(mapRow);

  // ── Filtros en frontend ──────────────────────────────────────────
  const norm = (s: string) =>
    (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (f.modalidades?.length)
    rows = rows.filter(r => f.modalidades!.some(m => norm(r.categoria) === norm(m)));

  if (f.niveles?.length)
    rows = rows.filter(r => f.niveles!.includes(normalizeNivel(r.nivelAcademico)));

  if (f.periodos?.length)
    rows = rows.filter(r => f.periodos!.some(p => norm(r.periodo) === norm(p)));

  if (f.centros?.length)
    rows = rows.filter(r => f.centros!.some(c => norm(r.centro ?? '') === norm(c)));

  if (f.nivelesFormacion?.length)
    rows = rows.filter(r => f.nivelesFormacion!.some(n => norm(r.nivelFormacion ?? '') === norm(n)));

  if (f.periodicidades?.length)
    rows = rows.filter(r => f.periodicidades!.some(p => norm(r.periodicidad ?? '') === norm(p)));

  if (f.facultades?.length)
    rows = rows.filter(r => f.facultades!.some(fc => norm(r.facultad ?? '') === norm(fc)));

  if (f.sedes?.length)
    rows = rows.filter(r => f.sedes!.some(s => norm(r.rectoria ?? '') === norm(s)));

  if (f.programas?.length)
    rows = rows.filter(r => f.programas!.some(p => norm(r.programa ?? '') === norm(p)));

  return { total: rows.length, rows };
}
