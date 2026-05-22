// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Gauge } from "lucide-react";
import { FiltersMulti } from "./components/FiltersMulti";
import { DashboardCharts } from "./components/DashboardCharts";
import { virtual2026S1Data } from "./data/virtual2026S1Data";
import {
  fetchAzureData,
  fetchTableMulti,
  FiltersMulti as F
} from "./services/azureService";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, Legend
} from "recharts";
import { ParetoProyectado } from "./components/ParetoProyectado";
import ColaboradoresView from "./components/ColaboradoresView";
import ComparativosView from "./components/ComparativosView";
import { OfertaView } from "./components/OfertaView";

const API_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  "http://localhost:3001";

// ==================== INTERFACES ====================

interface BaseOptions {
  years: string[];
  modalidades: string[];
  niveles: string[];
  periodos: string[];
  centros: string[];
  periodicidades: string[];
  nivelesFormacion: string[];
  facultades: string[];
  sedes: string[];
}

interface StatsData {
  [key: string]: any;
}

interface BreakdownItem {
  nivelAcademico: string;
  categoria: string;
  nuevos: number;
  continuos: number;
  totales: number;
  programa?: string;
  count?: number;
  [key: string]: any;
}

interface ParetoItem {
  porcentaje: number;
  programa: string;
  valor: number;
  acumulado?: number;
}

// ==================== CONSTANTES ====================

const ORDEN_CENTROS = [
  "Especial Minuto de Dios - Engativá",
  "Kennedy",
  "Las Cruces - Santa Fe",
  "Perdomo - Ciudad Bolívar",
  "San Cristóbal Norte - Usaquén"
];

const clean = (t: string) => (t || "").trim().toLowerCase();

// ==================== HELPERS ====================

const normalizeNivel = (nivel: string): string => {
  const n = (nivel || "").toString().toLowerCase().trim();
  if (
    n.includes("posgrado") ||
    n.includes("especial") ||
    n.includes("maestr") ||
    n.includes("doctor")
  ) return "Posgrado";
  return "Pregrado";
};

const mapModalidad = (m?: string): string => {
  const x = (m ?? "").toLowerCase();
  if (x.includes("presencial")) return "Presencial";
  if (x.includes("distancia") || x.includes("virtual")) return "Distancia";
  return "Otra";
};

// ✅ HOISTED: getFacSigla declarada a nivel de módulo para evitar error de uso antes de declaración
const getFacSigla = (fac?: string): string | null => {
  if (!fac) return null;
  
  const siglas = ["FCCO", "FCEM", "FCHS", "FCSA", "FEBPE", "FEDU", "FING"];
  
  // Si ya es una sigla válida, devolverla directamente
  if (siglas.includes(fac.toUpperCase())) {
    return fac.toUpperCase();
  }
  
  // Si no, intentar mapear por nombre completo
  const f = fac
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (f.includes("contable") || f.includes("contaduria")) return "FCCO";
  if (f.includes("empresarial") || f.includes("econom") || f.includes("administracion")) return "FCEM";
  if (f.includes("human") || f.includes("psicologia") || f.includes("comunicacion")) return "FCHS";
  if (f.includes("social aplicada") || f.includes("trabajo social") || f.includes("derecho")) return "FCSA";
  if (f.includes("bienestar") || f.includes("salud") || f.includes("enfermeria")) return "FEBPE";
  if (f.includes("educacion") || f.includes("licenciatura") || f.includes("pedagogia")) return "FEDU";
  if (f.includes("ingenier") || f.includes("tecnologia") || f.includes("sistemas")) return "FING";

  console.log("Facultad no mapeada:", fac);
  return null;
};

// ==================== APP ====================

function App() {

  // ── Base de opciones para los combos ──
  const [base, setBase] = useState<BaseOptions>({
    years: [],
    modalidades: [],
    niveles: [],
    periodos: [],
    centros: [],
    periodicidades: [],
    nivelesFormacion: [],
    facultades: [],
    sedes: []
  });

  // ── Constantes ──
  const fechaCorte = "20 de marzo de 2026";

  // ── Navegación ──
  const [activeTab, setActiveTab] = useState("estudiantes");
  const [subViewEstudiantes, setSubViewEstudiantes] = useState<"dashboard" | "pareto">("dashboard");
  const [subViewPareto, setSubViewPareto] = useState<"ejecutado" | "proyectado">("ejecutado");

  // ── Selecciones de filtros ──
  const [selYears, setSelYears] = useState<string[]>([]);
  const [selModalidades, setSelModalidades] = useState<string[]>([]);
  const [selNiveles, setSelNiveles] = useState<string[]>([]);
  const [selPeriodos, setSelPeriodos] = useState<string[]>([]);
  const [selCentros, setSelCentros] = useState<string[]>([]);
  const [selNivelFormacion, setSelNivelFormacion] = useState<string[]>([]);
  const [selProgramas, setSelProgramas] = useState<string[]>([]);
  const [selPeriodicidades, setSelPeriodicidades] = useState<string[]>([]);
  const [selNivelesFormacion, setSelNivelesFormacion] = useState<string[]>([]);
  const [selSedes, setSelSedes] = useState<string[]>([]);
  const [selFacultades, setSelFacultades] = useState<string[]>([]);

  // ── Datos del dashboard ──
  const [stats, setStats] = useState<StatsData | null>(null);
  const [modalidadBreakdown, setModalidadBreakdown] = useState<BreakdownItem[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [ausDes, setAusDes] = useState<any[]>([]);
  const [byCentro, setByCentro] = useState<any[]>([]);
  const [byEscuela, setByEscuela] = useState<any[]>([]);
  const [virtual2026S1, setVirtual2026S1] = useState<any[]>([]);

  // ── Pareto ──
  const [paretoData, setParetoData] = useState<ParetoItem[]>([]);
  const [pareto80, setPareto80] = useState<ParetoItem[]>([]);
  const [pareto20, setPareto20] = useState<ParetoItem[]>([]);
  const [listaProgramas, setListaProgramas] = useState<{ label: string; value: string }[]>([]);
  const [highlightBar, setHighlightBar] = useState(false);
  const [highlightLine, setHighlightLine] = useState(false);

  // ── UI ──
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  // ==================== PARSED YEARS / PERIODOS (reactivo) ====================
  const { parsedYears, parsedPeriodos } = useMemo(() => {
    const years: string[] = [];
    const periodos: string[] = [];

    selPeriodos.forEach(p => {
      if (p.includes("-")) {
        const idx = p.indexOf("-");
        const year = p.slice(0, idx);
        const periodo = p.slice(idx + 1);
        if (/^\d{4}$/.test(year)) years.push(year);
        if (periodo) periodos.push(periodo);
      } else {
        periodos.push(p);
      }
    });

    return {
      parsedYears: [...new Set(years)],
      parsedPeriodos: [...new Set(periodos)],
    };
  }, [selPeriodos]);

  // ==================== FILTROS EFECTIVOS ====================

  const filtersDashboard: F = useMemo(() => {
    const hasPeriodFilter = selPeriodos.length > 0;

    return {
      years: parsedYears.length ? parsedYears : selYears,
      modalidades: selModalidades,
      niveles: selNiveles,
      periodos: hasPeriodFilter ? parsedPeriodos : [],
      centros: selCentros,
    };
  }, [parsedYears, parsedPeriodos, selYears, selModalidades, selNiveles, selCentros, selPeriodos]);

  // ==================== CARGA BASE DE COMBOS ====================

  // 1) Años: siempre fijos 2026→2020 desde el backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/filtros/years`);
        const years = await res.json();
        setBase(prev => ({ ...prev, years }));
      } catch (e) {
        console.error("Error cargando años:", e);
      }
    })();
  }, []);

  // 2) Selección inicial: el año más reciente disponible
  useEffect(() => {
    if (!base.years || base.years.length === 0) return;
    setSelYears(prev => {
      if (prev.length > 0 && prev.every(y => base.years.includes(y))) return prev;
      return [base.years[0]];
    });
  }, [base.years]);

  // 3) Resto de combos: modalidades, períodos combinados, centros, etc.
  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAzureData();

        const periodicidades = [...new Set(
          all.map(d => (d.periodicidad ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const nivelesFormacion = [...new Set(
          all.map(d => (d.nivelFormacion ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const facultades = [...new Set(
          all.map(d => (d.facultad ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const periodosCombinados = [...new Set(
          all
            .map(d => (d.fecha && d.periodo) ? `${d.fecha}-${d.periodo}` : "")
            .filter(Boolean)
        )].sort((a, b) => b.localeCompare(a));

        const sedes = [...new Set(
          all.map(d => (d.rectoria ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const programas = [...new Set(
          all.map(d => (d.programa ?? d.siglasPrograma ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        setListaProgramas(programas.map(p => ({ label: p, value: p })));

        const modalidades = [...new Set(
          all.map(d => (d.categoria ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const niveles = [...new Set(
          all.map(d => normalizeNivel(d.nivelAcademico))
        )].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const centros = [...new Set(
          all.map(d => (d.centro ?? "").toString().trim()).filter(Boolean)
        )].sort((a, b) => {
          const indexA = ORDEN_CENTROS.indexOf(a);
          const indexB = ORDEN_CENTROS.indexOf(b);

          // Si ambos están en la lista, usar ese orden
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }

          // Si solo uno está en la lista priorizada
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;

          // Los demás se ordenan alfabéticamente al final
          return a.localeCompare(b, "es", { sensitivity: "base" });
        });

        setSelNiveles(prev =>
          prev.map(normalizeNivel).filter(v => ["Pregrado", "Posgrado"].includes(v))
        );

        setBase(prev => ({
          ...prev,
          modalidades,
          niveles,
          periodos: periodosCombinados,
          centros,
          periodicidades,
          nivelesFormacion,
          facultades,
          sedes
        }));

      } catch (e) {
        console.error("Error cargando combos:", e);
      }
    })();
  }, []);

  // Reset subview al cambiar de tab
  useEffect(() => {
    if (activeTab !== "estudiantes") {
      setSubViewEstudiantes("dashboard");
    }
  }, [activeTab]);

  // ==================== PARETO ====================

  const dataChart = paretoData.map(p => ({
    ...p,
    fill: p.porcentaje <= 80 ? "#22c55e" : "#93c5fd"
  }));

  const loadPareto = async () => {
    const filters = {
      years: parsedYears.length ? parsedYears : selYears,
      modalidades: selModalidades,
      niveles: selNiveles,      
      nivelesFormacion: selNivelFormacion.length ? selNivelFormacion : undefined,
      periodos: parsedPeriodos,
      centros: selCentros,
      programas: selProgramas,
      periodicidades: selPeriodicidades,
      sedes: selSedes,
      facultades: selFacultades
    };

    const res = await fetchTableMulti(filters);
    buildPareto(res.rows);
  };

  const buildPareto = (data: any[]) => {
    const map: Record<string, number> = {};

    data.forEach(d => {
      const programa = d.programa || d.programaAcademico || d.nombrePrograma || "Sin nombre";
      const valor = d.nuevos ?? d.estudiantes ?? d.total ?? 0;
      if (!programa || valor === 0) return;
      map[programa] = (map[programa] || 0) + valor;
    });

    const arr = Object.entries(map).map(([programa, valor]) => ({
      programa,
      valor,
      acumulado: 0,
      porcentaje: 0,
    }));

    arr.sort((a, b) => b.valor - a.valor);

    const total = arr.reduce((acc, cur) => acc + cur.valor, 0);
    let acumulado = 0;

    arr.forEach(item => {
      acumulado += item.valor;
      item.acumulado = acumulado;
      item.porcentaje = total ? (acumulado / total) * 100 : 0;
    });

    const top80: typeof arr = [];
    const rest20: typeof arr = [];

    for (const item of arr) {
      if (top80.length === 0 || top80[top80.length - 1].porcentaje < 80) {
        top80.push(item);
      } else {
        rest20.push(item);
      }
    }

    setParetoData(arr);
    setPareto80(top80);
    setPareto20(rest20);
  };

  // ==================== DASHBOARD ====================

  const loadDashboard = async () => {
    setIsLoading(true);
    setErr(null);

    try {
      const res = await fetchTableMulti({
        years: selYears,
        modalidades: selModalidades,
        niveles: selNiveles,
        periodos: selPeriodos.length ? parsedPeriodos : [],
        centros: selCentros,
        pageSize: 10000,
      });

      const rows = res.rows;

      // ── byCentro: Centro Universitario → Centro de Operación → Modalidad ──
      // Estructura jerárquica que coincide con la imagen:
      // Centro Universitario (nivel 1)
      //   └── Centro de Operación / Sede (nivel 2)
      //         └── Modalidad: Distancia / Presencial (nivel 3)

const centroMap: Record<string, any> = {};

rows.forEach(r => {
  const centroUniversitario = r.centro || "Sin centro";
  const centroOperacionRaw = r.centroOperacion?.trim();
  const centroOperacion =
    centroOperacionRaw && centroOperacionRaw.length > 0
      ? centroOperacionRaw
      : null;


  const modalidad = mapModalidad(r.categoria);

  // ── Nivel 1: Centro Universitario ──
  if (!centroMap[centroUniversitario]) {
    centroMap[centroUniversitario] = {
      categoria: centroUniversitario,
      nuevos: 0,
      continuos: 0,
      total: 0,
      operaciones: {}
    };
  }

  // ── Nivel 2: Centro de Operación ──
  const opKey = centroOperacion ?? "__SIN_OPERACION__";

  if (!centroMap[centroUniversitario].operaciones[opKey]) {
    centroMap[centroUniversitario].operaciones[opKey] = {
      nombre: centroOperacion ?? "",
      nuevos: 0,
      continuos: 0,
      total: 0,
      modalidades: {}
    };
  }

  // ── Nivel 3: Modalidad ──
  if (!centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad]) {
    centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad] = {
      nombre: modalidad,
      nuevos: 0,
      continuos: 0,
      total: 0
    };
  }

  const nuevos = r.nuevos ?? 0;
  const continuos = r.continuos ?? 0;
  const totales = r.totales ?? 0;

  // Totales Centro Universitario
  centroMap[centroUniversitario].nuevos += nuevos;
  centroMap[centroUniversitario].continuos += continuos;
  centroMap[centroUniversitario].total += totales;

  // Totales Centro de Operación
  const op = centroMap[centroUniversitario].operaciones[opKey];
  op.nuevos += nuevos;
  op.continuos += continuos;
  op.total += totales;

  // Totales Modalidad
  const mod = op.modalidades[modalidad];
  mod.nuevos += nuevos;
  mod.continuos += continuos;
  mod.total += totales;
});

const ordenarCentros = (lista: any[]) => {
  return lista.sort((a, b) => {
    const indexA = ORDEN_CENTROS.indexOf(a.categoria);
    const indexB = ORDEN_CENTROS.indexOf(b.categoria);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return a.categoria.localeCompare(b.categoria, "es");
  });
};

const byCentroOrdenado = ordenarCentros(
  Object.values(centroMap).map((c: any) => ({
    categoria: c.categoria,
    nuevos: c.nuevos,
    continuos: c.continuos,
    total: c.total,
    operaciones: Object.values(c.operaciones).map((o: any) => ({
      nombre: o.nombre,
      nuevos: o.nuevos,
      continuos: o.continuos,
      total: o.total,
      modalidades: Object.values(o.modalidades)
    }))
  }))
);

setByCentro(byCentroOrdenado);


      // ── byEscuela: Centro Universitario → Centro de Operación → columnas por Facultad ──
      // Estructura jerárquica que coincide con la imagen derecha:
      // Centro Universitario (nivel 1, sin centroOperacion)
      //   └── Centro de Operación (nivel 2, con centroOperacion = nombre del CU padre)
      // Fila Total al final

      

// En App.tsx, reemplazar la sección de construcción de byEscuela:

// ── byEscuela CORRECTO: Centro Universitario (PADRE) → Centro de Operación (HIJO) ──

const FAC_COLUMNS = ["FCCO", "FCEM", "FCHS", "FCSA", "FEBPE", "FEDU", "FING"] as const;

// facMap[PADRE][HIJO] = acumulado por facultad
const facMap: Record<string, Record<string, Record<string, number>>> = {};

// Procesar filas
rows.forEach(r => {
  const centroUniversitario = r.centro || "Sin centro";     // ✅ PADRE
  const centroOperacionRaw = r.centroOperacion?.trim();
  const centroOperacion =
    centroOperacionRaw && centroOperacionRaw.length > 0
      ? centroOperacionRaw                                // ✅ HIJO
      : centroUniversitario;                              // si no hay sede, se replica

  const fac = getFacSigla(r.facultad);
  const valor = r.totales ?? 0;

  if (!fac || valor === 0) return;

  if (!facMap[centroUniversitario]) {
    facMap[centroUniversitario] = {};
  }

  if (!facMap[centroUniversitario][centroOperacion]) {
    facMap[centroUniversitario][centroOperacion] = {
      FCCO: 0, FCEM: 0, FCHS: 0, FCSA: 0, FEBPE: 0, FEDU: 0, FING: 0
    };
  }

  facMap[centroUniversitario][centroOperacion][fac] += valor;
});

// Construir byEscuela
const escuelaRows: any[] = [];
const totalGeneral: Record<string, number> = {};
FAC_COLUMNS.forEach(c => (totalGeneral[c] = 0));

const clean = (t: string) => (t || "").trim().toLowerCase();

// ✅ Orden centros (padres)
const centrosOrdenados = Object.keys(facMap).sort((a, b) => {
  const indexA = ORDEN_CENTROS.findIndex(x => clean(x) === clean(a));
  const indexB = ORDEN_CENTROS.findIndex(x => clean(x) === clean(b));

  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;

  return a.localeCompare(b, "es");
});

// ✅ Construcción ORDENADA REAL
for (const centroUniversitario of centrosOrdenados) {

  // ── PADRE ──
  const parentRow: any = {
    centro: centroUniversitario,
    centroOperacion: "",
    total: 0
  };
  FAC_COLUMNS.forEach(c => (parentRow[c] = 0));

  // ✅ Orden hijos
  const hijosOrdenados = Object.keys(facMap[centroUniversitario]).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  const hijosRows: any[] = [];

  for (const centroOperacion of hijosOrdenados) {
    const facs = facMap[centroUniversitario][centroOperacion];

    const childRow: any = {
      centro: centroOperacion,
      centroOperacion: centroUniversitario,
      total: 0,
      ...facs
    };

    FAC_COLUMNS.forEach(c => {
      childRow.total += facs[c];
      parentRow[c] += facs[c];
      totalGeneral[c] += facs[c];
    });

    hijosRows.push(childRow);
  }

  parentRow.total = FAC_COLUMNS.reduce((s, c) => s + parentRow[c], 0);

  // ✅ ORDEN CORRECTO: padre → hijos
  escuelaRows.push(parentRow, ...hijosRows);
}

// Fila Total general
const totalRow: any = { centro: "Total", centroOperacion: "", total: 0 };
FAC_COLUMNS.forEach(c => {
  totalRow[c] = totalGeneral[c];
  totalRow.total += totalGeneral[c];
});
escuelaRows.push(totalRow);

setByEscuela(escuelaRows);

console.log("=== byEscuela DEBUG ===");
console.log("Total rows:", escuelaRows.length);
console.log("Sample parent row:", escuelaRows.find(r => r.centroOperacion === ""));
console.log("Sample child row:", escuelaRows.find(r => r.centroOperacion !== "" && r.centroOperacion !== "Total"));
console.log("All rows:", escuelaRows);


      // ── Ausentes / Desertores ──
      const ausMap: Record<string, { aus: number; des: number; total: number }> = {};

      rows.forEach(r => {
        const mod = mapModalidad(r.categoria ?? r.categoria);
        if (!ausMap[mod]) ausMap[mod] = { aus: 0, des: 0, total: 0 };

        const nuevos    = r.nuevos    ?? r.nuevos    ?? 0;
        const continuos = r.continuos ?? r.continuos ?? 0;
        const totales   = r.totales   ?? r.totales   ?? 0;

        ausMap[mod].aus += Math.max(nuevos - continuos, 0);
        ausMap[mod].des += Math.max(totales - continuos, 0);
        ausMap[mod].total += totales;
      });

      const totalAus = Object.values(ausMap).reduce(
        (a, b) => ({
          aus: a.aus + b.aus,
          des: a.des + b.des,
          total: a.total + b.total
        }),
        { aus: 0, des: 0, total: 0 }
      );

      setAusDes([
        ...Object.entries(ausMap).map(([modalidad, v]) => ({
          modalidad,
          ausentes: v.aus,
          pct_ausentes: v.total ? (v.aus / v.total) * 100 : 0,
          desertores: v.des,
          pct_desertores: v.total ? (v.des / v.total) * 100 : 0
        })),
        {
          modalidad: "UNIMINUTO Bogotá",
          ausentes: totalAus.aus,
          pct_ausentes: totalAus.total ? (totalAus.aus / totalAus.total) * 100 : 0,
          desertores: totalAus.des,
          pct_desertores: totalAus.total ? (totalAus.des / totalAus.total) * 100 : 0
        }
      ]);

      // ── Virtual 2026-S1 ──
      const virtuales = virtual2026S1Data.filter(
        v => v.ano === "2026" && v.periodo === "2026-1"
      );
      setVirtual2026S1(virtuales);

      // ── KPIs ──
      const estudiantes = rows.reduce((a, b) => a + (b.totales ?? 0), 0);
      const centrosCount = new Set(rows.map(r => r.centro ?? r.centro)).size;
      const modalidadesCount = new Set(rows.map(r => r.categoria ?? r.categoria)).size;
      const programasCount = new Set(rows.map(r => r.programa ?? r.programa)).size;

      setStats({
        estudiantes,
        centros: centrosCount,
        modalidades: modalidadesCount,
        programas: programasCount
      });

      // ── Tendencia por año ──
      const trendMap: Record<string, number> = {};
      rows.forEach(r => {
        const key = r.fecha ?? r.fecha ?? r.fecha ?? "";
        if (!key) return;
        trendMap[key] = (trendMap[key] ?? 0) + (r.totales ?? r.totales ?? 0);
      });

      setTrend(
        Object.entries(trendMap)
          .map(([fecha, valor]) => ({ fecha, valor }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
      );

      // ── Modalidad + Nivel ──
      const modalMap: any = {};
      rows.forEach(r => {
        const key = `${r.nivelAcademico}|${r.categoria ?? r.categoria}`;
        if (!modalMap[key]) {
          modalMap[key] = {
            nivelAcademico: r.nivelAcademico,
            categoria: r.categoria ?? r.categoria,
            nuevos: 0,
            continuos: 0,
            totales: 0,
          };
        }
        modalMap[key].nuevos    += r.nuevos    ?? r.nuevos    ?? 0;
        modalMap[key].continuos += r.continuos ?? r.continuos ?? 0;
        modalMap[key].totales   += r.totales   ?? r.totales   ?? 0;
      });

      setModalidadBreakdown(Object.values(modalMap));

    } catch (e: any) {
      setErr(e.message || "Error cargando datos");
    } finally {
      setIsLoading(false);
    }
  };

  const forceRefresh = async () => {
    await fetch(`${API_URL}/api/cache/clear`, { method: "POST" });
    loadDashboard();
  };

  // Disparar carga al cambiar filtros o subvista
  useEffect(() => {
    if (subViewEstudiantes === "pareto") {
      loadPareto();
    } else {
      loadDashboard();
    }
  }, [
    subViewEstudiantes,
    selYears,
    selModalidades,
    selNiveles,
    selPeriodos,
    selCentros,
    selPeriodicidades,
    selNivelFormacion,
    selProgramas,
    selSedes,
    selFacultades,
    base.periodicidades.length,

  ]);

  // ==================== ACCIONES ====================

  const clearAll = () => {
    setSelYears([base.years[0] ?? "2026"]);
    setSelModalidades([]);
    setSelNiveles([]);
    setSelPeriodos([]);
    setSelCentros([]);
    setSelNivelFormacion([]);
    setSelProgramas([]);
    setSelPeriodicidades([]);
    setSelNivelesFormacion([]);
    setSelSedes([]);
    setSelFacultades([]);
  };

  // ==================== RENDER ====================

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">

      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">

        {/* LOGO */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/Logo Bogotá 2.png"
            alt="Uniminuto"
            className="h-16 object-contain"
          />
          <div className="leading-tight truncate">
            <h1 className="text-sm font-bold text-gray-800">360 Resumen</h1>
            <p className="text-[10px] text-gray-500">UNIMINUTO • 2020–2026</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2">
            {["estudiantes", "colaboradores", "comparativos", "oferta", "investigacion"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs capitalize transition ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button
            onClick={forceRefresh}
            className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <RefreshCw size={18} /> Actualizar
          </button>
          <button
  onClick={() => window.open(
    "https://uniminuto0.sharepoint.com/:u:/r/sites/G-360/SitePages/TrainingHome.aspx?csf=1&web=1&e=xgeBy9",
    "_blank"
  )}
  className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700"
>
  <Gauge size={18} /> 360
</button>
        </div>

      </header>

      {/* MARQUEE */}
      <div className="bg-slate-900 text-white text-xs overflow-hidden border-y">
        <div className="overflow-hidden">
          <div
            className="flex whitespace-nowrap"
            style={{ animation: "marquee 30s linear infinite", width: "max-content" }}
          >
            {[...Array(6)].map((_, i) => (
              <span key={i} className="px-6">
                Sistema Integrado de Información · Corte: {fechaCorte}
              </span>
            ))}
            {[...Array(6)].map((_, i) => (
              <span key={`d-${i}`} className="px-6">
                Sistema Integrado de Información · Corte: {fechaCorte}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <div className="max-w-7xl mx-auto flex-1 min-h-0 flex flex-col gap-2">

          {/* STATUS */}
          <div className="flex justify-between text-[11px]">
            {err && <span className="text-red-500">{err}</span>}
            {isLoading && <span className="text-gray-500">Cargando…</span>}
          </div>

          {/* CONTENEDOR PRINCIPAL */}
          <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm p-3 flex flex-col">

            {/* HEADER INTERNO — solo en pestaña estudiantes */}
            {/* HEADER INTERNO — solo en pestaña estudiantes */}
{activeTab === "estudiantes" && (
  <div className="flex justify-end items-center mb-2">
    <button
      onClick={() =>
        setSubViewEstudiantes(prev => prev === "pareto" ? "dashboard" : "pareto")
      }
      className={`px-4 py-1.5 text-sm font-medium rounded-md shadow-sm transition ${
        subViewEstudiantes === "pareto"
          ? "bg-gray-500 text-white hover:bg-gray-600"
          : "bg-yellow-500 text-black hover:bg-yellow-600"
      }`}
    >
      {subViewEstudiantes === "pareto" ? "← Volver" : "Pareto"}
    </button>
  </div>
)}

            {/* CONTENIDO */}
            <div className="flex-1 min-h-0">

              {/* ── TAB: ESTUDIANTES ── */}
              {activeTab === "estudiantes" && (
                <div className="flex flex-col gap-3 h-full min-h-0">

                  {/* DASHBOARD */}
                  {subViewEstudiantes !== "pareto" && (
                    <DashboardCharts
                      stats={stats}
                      modalidadBreakdown={modalidadBreakdown}
                      trend={trend}
                      ausDes={ausDes}
                      byCentro={byCentro}
                      byEscuela={byEscuela}
                      virtual2026S1={virtual2026S1}
                      filtersComponent={
                        <FiltersMulti
                          years={base.years.map(y => ({ label: y, value: y }))}
                          modalidades={base.modalidades.map(m => ({ label: m, value: m }))}
                          niveles={base.niveles.map(n => ({ label: n, value: n }))}
                          periodos={base.periodos.map(p => ({ label: p, value: p }))}                           centros={base.centros.map(c => ({ label: c, value: c }))}
                          selYears={selYears} setSelYears={setSelYears}
                          selModalidades={selModalidades} setSelModalidades={setSelModalidades}
                          selNiveles={selNiveles} setSelNiveles={setSelNiveles}
                          selPeriodos={selPeriodos} setSelPeriodos={setSelPeriodos}

                          selCentros={selCentros} setSelCentros={setSelCentros}
                          clearAll={clearAll}
                        />
                      }
                    />
                  )}

                  {/* PARETO */}
                  {subViewEstudiantes === "pareto" && (
                    <>
                      {subViewPareto === "proyectado" ? (

                        // ── PARETO PROYECTADO ──
                        <ParetoProyectado
                          fechaCorte={fechaCorte}
                          base={base}
                          listaProgramas={listaProgramas}
                          pareto80={pareto80}
                          pareto20={pareto20}
                          dataChart={dataChart}
                          selYears={selYears} setSelYears={setSelYears}
                          selModalidades={selModalidades} setSelModalidades={setSelModalidades}
                          selNivelFormacion={selNivelFormacion} setSelNivelFormacion={setSelNivelFormacion}
                          selPeriodos={selPeriodos} setSelPeriodos={setSelPeriodos}
                          selCentros={selCentros} setSelCentros={setSelCentros}
                          selProgramas={selProgramas} setSelProgramas={setSelProgramas}
                          selPeriodicidades={selPeriodicidades} setSelPeriodicidades={setSelPeriodicidades}
                          selNiveles={selNiveles} setSelNiveles={setSelNiveles}
                          selNivelesFormacion={selNivelesFormacion} setSelNivelesFormacion={setSelNivelesFormacion}
                          selSedes={selSedes} setSelSedes={setSelSedes}
                          selFacultades={selFacultades} setSelFacultades={setSelFacultades}
                          clearAll={clearAll}
                          onVolver={() => setSubViewEstudiantes("dashboard")}
                          onIrEjecutado={() => setSubViewPareto("ejecutado")}
                        />

                      ) : (

                        // ── PARETO EJECUTADO ──
                        <div className="flex flex-col gap-4 h-full min-h-0">

                          {/* HEADER */}
<div className="flex flex-col sm:flex-row items-center gap-2">

  {/* BOTÓN */}
  <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
    <button
      onClick={() => setSubViewPareto("proyectado")}
      className="px-4 py-2 text-sm font-medium rounded-md shadow bg-yellow-400 text-black hover:bg-yellow-500 transition whitespace-nowrap"
    >
      Pareto proyectado
    </button>
  </div>

  {/* TÍTULO */}
  <div className="flex-1 w-full text-center">
    <h2 className="
      text-[11px] sm:text-sm md:text-base
      font-bold text-white bg-slate-700
      px-3 sm:px-6 py-2
      rounded-md
      text-center
      break-words
      w-full sm:w-auto
      mx-auto
    ">
      SEDE UNIMINUTO BOGOTÁ / PARETO EJECUTADO
    </h2>
  </div>

</div>

                          {/* FILTROS PARETO EJECUTADO */}
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <FiltersMulti
                              years={base.years.map(y => ({ label: y, value: y }))}
                              modalidades={base.modalidades.map(m => ({ label: m, value: m }))}
                              niveles={[]}                                                       
                              selNiveles={[]}                                                    
                              setSelNiveles={() => {}}                                           
                              nivelesFormacion={base.nivelesFormacion.map(n => ({ label: n, value: n }))}
                              selNivelesFormacion={selNivelFormacion}
                              setSelNivelesFormacion={setSelNivelFormacion}
                              periodos={base.periodos.map(p => ({ label: p, value: p }))}
                              centros={base.centros.map(c => ({ label: c, value: c }))}
                              programas={listaProgramas}
                              selProgramas={selProgramas}
                              setSelProgramas={setSelProgramas}
                              selYears={selYears} setSelYears={setSelYears}
                              selModalidades={selModalidades} setSelModalidades={setSelModalidades}
                              selPeriodos={selPeriodos} setSelPeriodos={setSelPeriodos}
                              selCentros={selCentros} setSelCentros={setSelCentros}
                              clearAll={clearAll}
                            />
                          </div>

                          {/* CONTENIDO PARETO EJECUTADO */}
                          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">

                            {/* COLUMNA IZQUIERDA: tablas */}
                            <div className="flex flex-col gap-3">

                              {/* TABLA 80% */}
                              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                  Programas que contienen el 80% de los estudiantes
                                </div>
                                <div className="overflow-y-auto max-h-56">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 sticky top-0">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa Académico</th>
                                        <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Est.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pareto80.map((p, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                          <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                                          <td className="px-2 py-1 text-slate-700">{p.programa}</td>
                                          <td className="px-2 py-1 text-right text-slate-700">{p.valor}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50 sticky bottom-0">
                                        <td className="px-2 py-1.5" />
                                        <td className="px-2 py-1.5 font-semibold text-slate-700">Total</td>
                                        <td className="px-2 py-1.5 text-right font-semibold text-slate-700">
                                          {pareto80.reduce((a, b) => a + b.valor, 0)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* TABLA 20% */}
                              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                  Programas que contienen el 20% de los estudiantes
                                </div>
                                <div className="overflow-y-auto max-h-56">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 sticky top-0">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa Académico</th>
                                        <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Est.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pareto20.map((p, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                          <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                                          <td className="px-2 py-1 text-slate-700">{p.programa}</td>
                                          <td className="px-2 py-1 text-right text-slate-700">{p.valor}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50 sticky bottom-0">
                                        <td className="px-2 py-1.5" />
                                        <td className="px-2 py-1.5 font-semibold text-slate-700">Total</td>
                                        <td className="px-2 py-1.5 text-right font-semibold text-slate-700">
                                          {pareto20.reduce((a, b) => a + b.valor, 0)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                            </div>

                            {/* GRÁFICA */}
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                Pareto de programas en relación a estudiantes nuevos
                              </div>
                              <div className="p-2 h-[500px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={dataChart} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis
                                      dataKey="programa"
                                      tick={{ fontSize: 9 }}
                                      interval={0}
                                      angle={-45}
                                      textAnchor="end"
                                      height={90}
                                    />
                                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                                    <YAxis
                                      yAxisId="right"
                                      orientation="right"
                                      domain={[0, 100]}
                                      tick={{ fontSize: 10 }}
                                      tickFormatter={(v) => `${v}%`}
                                    />
                                    <Legend
                                      verticalAlign="top"
                                      align="left"
                                      wrapperStyle={{ fontSize: 11, paddingBottom: 4, cursor: "pointer" }}
                                      formatter={(value) => {
                                        if (value === "porcentaje") return "Pareto Nuevos";
                                        if (value === "valor") return "Estudiantes Nuevos";
                                        return value;
                                      }}
                                      onClick={(e) => {
                                        if (e.dataKey === "porcentaje") setHighlightLine(prev => !prev);
                                        else setHighlightBar(prev => !prev);
                                      }}
                                    />
                                    <Tooltip
                                      formatter={(value, name) => {
                                        if (name === "valor") return [`${Number(value).toLocaleString()}`, "Estudiantes Nuevos"];
                                        if (name === "porcentaje") return [`${Number(value).toFixed(2)}%`, "Pareto Nuevos"];
                                        return [value, name];
                                      }}
                                    />
                                    <Bar yAxisId="left" dataKey="valor" name="Estudiantes Nuevos">
                                      {dataChart.map((entry, index) => {
                                        const baseColor = entry.fill;
                                        const darkColor = baseColor === "#22c55e" ? "#15803d" : "#2563eb";
                                        return (
                                          <Cell
                                            key={index}
                                            fill={highlightBar ? darkColor : baseColor}
                                            opacity={highlightBar ? 1 : 0.85}
                                          />
                                        );
                                      })}
                                    </Bar>
                                    <Line
                                      yAxisId="right"
                                      type="monotone"
                                      dataKey="porcentaje"
                                      name="Pareto Nuevos"
                                      stroke={highlightLine ? "#1e3a8a" : "#1d4ed8"}
                                      strokeWidth={highlightLine ? 3.5 : 2}
                                      dot={{ r: highlightLine ? 3.5 : 2, fill: highlightLine ? "#1e3a8a" : "#1d4ed8" }}
                                      label={{
                                        position: "top",
                                        fontSize: 8,
                                        fill: highlightLine ? "#1e3a8a" : "#1d4ed8",
                                        formatter: (v: number) => `${v.toFixed(1)}%`,
                                      }}
                                    />
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}

              {/* ── OTROS TABS ── */}
              {activeTab === "colaboradores" && <ColaboradoresView />}
              {activeTab === "comparativos" && <ComparativosView />}
              {activeTab === "oferta" && <OfertaView fechaCorte={fechaCorte} />}
              {activeTab === "investigacion" && (
                <div className="h-full w-full">
                  <iframe
                    title="Investigacion Power BI"
                    src="https://app.powerbi.com/view?r=eyJrIjoiNmI4OTU2YTItZDdkMy00ZDU4LWJkMzgtYTM5Yzc1MDUyYzUxIiwidCI6ImIxYmE4NWViLWEyNTMtNDQ2Ny05ZWU4LWQ0ZjhlZDRkZjMwMCIsImMiOjR9"
                    className="w-full h-[calc(100vh-180px)] rounded-md border"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              )}
              
{activeTab === "360" && (
  <div className="h-full w-full">
    <iframe
      title="Dashboard 360"
      src="https://uniminuto0.sharepoint.com/sites/G-360/SitePages/TrainingHome.aspx"
      className="w-full h-[calc(100vh-180px)] rounded-md border"
      frameBorder="0"
    />
  </div>
)}




            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;