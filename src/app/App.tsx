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
import { InvestigacionView } from "./components/InvestigacionView";
import { ParetoTablas } from "./components/ParetoTablas";
import { GraficaPareto } from "./components/GraficaPareto";
import { Panel } from "./components/Panel";


const API_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  "https://three60-resumen-backend.onrender.com";

// ==================== INTERFACES ====================

interface BaseOptions {
  years: string[];
  modalidades: string[];
  niveles: string[];
  periodos: string[];
  centros: string[];
  sufijoPeriodos: string[]; 
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
const getSufijos = (periodosCombinados: string[]): string[] => {
  const sufijos = new Set<string>();
  periodosCombinados.forEach(p => {
    const idx = p.indexOf("-");
    if (idx !== -1) {
      const sufijo = p.slice(idx + 1);
      if (sufijo) sufijos.add(sufijo);
    }
  });
  return [...sufijos].sort();
};

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

const getFacSigla = (fac?: string): string | null => {
  if (!fac) return null;

  const siglas = ["FCCO", "FCEM", "FCHS", "FCSA", "FEBPE", "FEDU", "FING"];
  if (siglas.includes(fac.toUpperCase())) return fac.toUpperCase();

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

  return null;
};

// ==================== APP ====================

function App() {

    // Estado de autenticación admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY; // en .env del frontend
  
  // Login admin
  const handleAdminLogin = () => {
    if (adminInput === ADMIN_KEY) {
      setIsAdmin(true);
      setShowLoginModal(false);
      setLoginError('');
      setAdminInput('');
    } else {
      setLoginError('Clave incorrecta');
    }
  };

  const [base, setBase] = useState<BaseOptions>({
    years: [],
    modalidades: [],
    niveles: [],
    periodos: [],
    centros: [],
    periodicidades: [],
    nivelesFormacion: [],
    facultades: [],
    sedes: [],
    sufijoPeriodos: []
  });

  const fechaCorte = "20 de marzo de 2026";

  const [activeTab, setActiveTab] = useState("estudiantes");
  const [subViewEstudiantes, setSubViewEstudiantes] = useState<"dashboard" | "pareto">("dashboard");
  const [subViewPareto, setSubViewPareto] = useState<"ejecutado" | "proyectado">("ejecutado");

    // DASHBOARD
  const [dashYears, setDashYears] = useState<string[]>([]);
  const [dashModalidades, setDashModalidades] = useState<string[]>([]);
  const [dashNiveles, setDashNiveles] = useState<string[]>([]);
  const [dashPeriodos, setDashPeriodos] = useState<string[]>([]);
  const [dashCentros, setDashCentros] = useState<string[]>([]);
  
  // PARETO EJECUTADO
  const [execYears, setExecYears] = useState<string[]>([]);
  const [execModalidades, setExecModalidades] = useState<string[]>([]);
  const [execNivelFormacion, setExecNivelFormacion] = useState<string[]>([]);
  const [execPeriodos, setExecPeriodos] = useState<string[]>([]);
  const [execCentros, setExecCentros] = useState<string[]>([]);
  const [execProgramas, setExecProgramas] = useState<string[]>([]);
  
  // PARETO PROYECTADO
  const [projYears, setProjYears] = useState<string[]>(["2026"]);
  const [projModalidades, setProjModalidades] = useState<string[]>([]);
  const [projNiveles, setProjNiveles] = useState<string[]>([]);
  const [projPeriodos, setProjPeriodos] = useState<string[]>([]);
  const [projCentros, setProjCentros] = useState<string[]>([]);
  const [projPeriodicidades, setProjPeriodicidades] = useState<string[]>([]);
  const [projNivelesFormacion, setProjNivelesFormacion] = useState<string[]>([]);
  const [projSedes, setProjSedes] = useState<string[]>([]);
  const [projFacultades, setProjFacultades] = useState<string[]>([]);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [modalidadBreakdown, setModalidadBreakdown] = useState<BreakdownItem[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [ausDes, setAusDes] = useState<any[]>([]);
  const [byCentro, setByCentro] = useState<any[]>([]);
  const [byEscuela, setByEscuela] = useState<any[]>([]);
  const [virtual2026S1, setVirtual2026S1] = useState<any[]>([]);
  const [paretoData, setParetoData] = useState<ParetoItem[]>([]);
  const [pareto80, setPareto80] = useState<{ pregrado: ParetoItem[]; posgrado: ParetoItem[] }>({ pregrado: [], posgrado: [] });
  const [pareto20, setPareto20] = useState<{ pregrado: ParetoItem[]; posgrado: ParetoItem[] }>({ pregrado: [], posgrado: [] });
  const [listaProgramas, setListaProgramas] = useState<{ label: string; value: string }[]>([]);
  const [highlightBar, setHighlightBar] = useState(false);
  const [highlightLine, setHighlightLine] = useState(false);

  const [dataChartPregrado, setDataChartPregrado] = useState<any[]>([]);
  const [dataChartPosgrado, setDataChartPosgrado] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  // ==================== CARGA BASE DE COMBOS ====================

  // Dashboard
useEffect(() => {
  if (dashYears.length === 0 && base.years.length === 0) return;
  if (base.modalidades.length === 0 && base.centros.length === 0) return;
  if (subViewEstudiantes !== "pareto") loadDashboard();
}, [subViewEstudiantes, dashYears, dashModalidades, dashNiveles, dashPeriodos, dashCentros,
    base.modalidades.length, base.centros.length]);

// Pareto ejecutado
useEffect(() => {
  if (base.modalidades.length === 0 && base.centros.length === 0) return;
  if (subViewEstudiantes === "pareto" && subViewPareto === "ejecutado") loadPareto();
}, [subViewEstudiantes, subViewPareto, execYears, execModalidades, execNivelFormacion,
    execPeriodos, execCentros, execProgramas, base.modalidades.length]);

// Pareto proyectado — su propia loadPareto con filtros proj*
useEffect(() => {
  if (base.modalidades.length === 0) return;
  if (subViewEstudiantes === "pareto" && subViewPareto === "proyectado") {
    const filters = {
      years: projYears,
      modalidades: projModalidades,
      niveles: projNiveles,
      periodos: projPeriodos,
      centros: projCentros,
      periodicidades: projPeriodicidades,
      nivelesFormacion: projNivelesFormacion,
      sedes: projSedes,
      facultades: projFacultades,
    };
    fetchTableMulti(filters).then(res => buildPareto(res.rows));
  }
}, [subViewEstudiantes, subViewPareto, projYears, projModalidades, projNiveles, projPeriodos,
    projCentros, projPeriodicidades, projNivelesFormacion, projSedes, projFacultades,
    base.modalidades.length]);
  
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
  
useEffect(() => {
  if (!base.years || base.years.length === 0) return;
  const firstYear = base.years[0];
  setDashYears(prev =>
    prev.length > 0 && prev.every(y => base.years.includes(y)) ? prev : [firstYear]
  );
  setExecYears(prev =>
    prev.length > 0 && prev.every(y => base.years.includes(y)) ? prev : [firstYear]
  );
}, [base.years]);
  
useEffect(() => {
  (async () => {
    const all = await fetchAzureData(); // devuelve [] si no hay cache, sin errores
    console.log("🔍 fetchAzureData resultado:", all?.length, all?.[0]);

 
    // Si no hay datos aún (Redis vacío), no hacer nada —
    // el usuario debe pulsar "Actualizar"
    if (!all || all.length === 0) return;
 
    const periodicidades = [...new Set(
      all.map(d => (d.periodicidad ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const nivelesFormacion = [...new Set(
      all.map(d => (d.nivelFormacion ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const facultades = [...new Set(
      all.map(d => (d.facultad ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const periodosCombinados = [...new Set(
      all
        .map(d => (d.fecha && d.periodo) ? `${d.fecha}-${d.periodo}` : '')
        .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a));
 
    const sedes = [...new Set(
      all.map(d => (d.rectoria ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const programas = [...new Set(
      all.map(d => (d.programa ?? d.siglasPrograma ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    setListaProgramas(programas.map(p => ({ label: p, value: p })));
 
    const modalidades = [...new Set(
      all.map(d => (d.categoria ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const niveles = [...new Set(
      all.map(d => normalizeNivel(d.nivelAcademico))
    )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
    const centros = [...new Set(
      all.map(d => (d.centro ?? '').toString().trim()).filter(Boolean)
    )].sort((a, b) => {
      const indexA = ORDEN_CENTROS.indexOf(a);
      const indexB = ORDEN_CENTROS.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });
 

 
    setBase(prev => ({
      ...prev,
      modalidades,
      niveles,
      periodos: periodosCombinados,
      sufijoPeriodos: getSufijos(periodosCombinados), 
      centros,
      periodicidades,
      nivelesFormacion,
      facultades,
      sedes,
    }));
  })();
}, []);
 

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
    years: execYears.length ? execYears : [base.years[0]],
    modalidades: execModalidades,
    nivelesFormacion: execNivelFormacion.length ? execNivelFormacion : undefined,
    periodos: execPeriodos,
    centros: execCentros,
    programas: execProgramas,
  };
  const res = await fetchTableMulti(filters);
  buildPareto(res.rows);
};

const buildPareto = (data: any[]) => {
  const buildForNivel = (rows: any[]) => {
    const map: Record<string, number> = {};
    rows.forEach(d => {
      const programa = d.programa || d.programaAcademico || d.nombrePrograma || "Sin nombre";
      const valor = d.nuevos ?? d.estudiantes ?? d.total ?? 0;
      if (!programa || valor === 0) return;
      map[programa] = (map[programa] || 0) + valor;
    });

    const arr = Object.entries(map).map(([programa, valor]) => ({
      programa, valor, acumulado: 0, porcentaje: 0,
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
      if (top80.length === 0 || top80[top80.length - 1].porcentaje < 80) top80.push(item);
      else rest20.push(item);
    }

    return { all: arr, top80, rest20 };
  };

  const pregradoRows = data.filter(d => normalizeNivel(d.nivelAcademico) === "Pregrado");
  const posgradoRows = data.filter(d => normalizeNivel(d.nivelAcademico) === "Posgrado");

  const pregrado = buildForNivel(pregradoRows);
  const posgrado = buildForNivel(posgradoRows);

  setPareto80({ pregrado: pregrado.top80, posgrado: posgrado.top80 });
  setPareto20({ pregrado: pregrado.rest20, posgrado: posgrado.rest20 });

  // ← dataChart separados por nivel
  setDataChartPregrado(pregrado.all.map(p => ({
    ...p,
    fill: p.porcentaje <= 80 ? "#22c55e" : "#93c5fd"
  })));
  setDataChartPosgrado(posgrado.all.map(p => ({
    ...p,
    fill: p.porcentaje <= 80 ? "#a855f7" : "#c4b5fd"  // morado para posgrado
  })));

  // Combinado ya no es necesario, pero si lo usas en otro lado:
  setParetoData([...pregrado.all, ...posgrado.all]);
};

  // ==================== DASHBOARD ====================

  const loadDashboard = async () => {
    setIsLoading(true);
    setErr(null);

    try {
      const res = await fetchTableMulti({
        years: dashYears.length ? dashYears : [base.years[0]],   // ← dash*
        modalidades: dashModalidades,
        niveles: dashNiveles,
        periodos: dashPeriodos,   // ya son sufijos S1/S2/etc.
        centros: dashCentros,
        pageSize: 10000,
      });

      const rows = res.rows;

      console.log("🔍 rows recibidos:", rows.length, rows[0]);

      

      // ── byCentro ──
      const centroMap: Record<string, any> = {};

      rows.forEach(r => {
        const centroUniversitario = r.centro || "Sin centro";
        const centroOperacionRaw = r.centroOperacion?.trim();
        const centroOperacion =
          centroOperacionRaw && centroOperacionRaw.length > 0 ? centroOperacionRaw : null;
        const modalidad = mapModalidad(r.categoria);

        if (!centroMap[centroUniversitario]) {
          centroMap[centroUniversitario] = {
            categoria: centroUniversitario,
            nuevos: 0, continuos: 0, total: 0,
            operaciones: {}
          };
        }

        const opKey = centroOperacion ?? "__SIN_OPERACION__";

        if (!centroMap[centroUniversitario].operaciones[opKey]) {
          centroMap[centroUniversitario].operaciones[opKey] = {
            nombre: centroOperacion ?? "",
            nuevos: 0, continuos: 0, total: 0,
            modalidades: {}
          };
        }

        if (!centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad]) {
          centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad] = {
            nombre: modalidad, nuevos: 0, continuos: 0, total: 0
          };
        }

        const nuevos = r.nuevos ?? 0;
        const continuos = r.continuos ?? 0;
        const totales = r.totales ?? 0;

        centroMap[centroUniversitario].nuevos += nuevos;
        centroMap[centroUniversitario].continuos += continuos;
        centroMap[centroUniversitario].total += totales;

        const op = centroMap[centroUniversitario].operaciones[opKey];
        op.nuevos += nuevos;
        op.continuos += continuos;
        op.total += totales;

        const mod = op.modalidades[modalidad];
        mod.nuevos += nuevos;
        mod.continuos += continuos;
        mod.total += totales;
      });

      const ordenarCentros = (lista: any[]) =>
        lista.sort((a, b) => {
          const indexA = ORDEN_CENTROS.indexOf(a.categoria);
          const indexB = ORDEN_CENTROS.indexOf(b.categoria);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.categoria.localeCompare(b.categoria, "es");
        });

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

      // ── byEscuela ──
      const FAC_COLUMNS = ["FCCO", "FCEM", "FCHS", "FCSA", "FEBPE", "FEDU", "FING"] as const;
      const facMap: Record<string, Record<string, Record<string, number>>> = {};

      rows.forEach(r => {
        const centroUniversitario = r.centro || "Sin centro";
        const centroOperacionRaw = r.centroOperacion?.trim();
        const centroOperacion =
          centroOperacionRaw && centroOperacionRaw.length > 0
            ? centroOperacionRaw
            : centroUniversitario;

        const fac = getFacSigla(r.facultad);
        const valor = r.totales ?? 0;
        if (!fac || valor === 0) return;

        if (!facMap[centroUniversitario]) facMap[centroUniversitario] = {};
        if (!facMap[centroUniversitario][centroOperacion]) {
          facMap[centroUniversitario][centroOperacion] = {
            FCCO: 0, FCEM: 0, FCHS: 0, FCSA: 0, FEBPE: 0, FEDU: 0, FING: 0
          };
        }
        facMap[centroUniversitario][centroOperacion][fac] += valor;
      });

      const escuelaRows: any[] = [];
      const totalGeneral: Record<string, number> = {};
      FAC_COLUMNS.forEach(c => (totalGeneral[c] = 0));

      const centrosOrdenados = Object.keys(facMap).sort((a, b) => {
        const indexA = ORDEN_CENTROS.findIndex(x => clean(x) === clean(a));
        const indexB = ORDEN_CENTROS.findIndex(x => clean(x) === clean(b));
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, "es");
      });

      for (const centroUniversitario of centrosOrdenados) {
        const parentRow: any = { centro: centroUniversitario, centroOperacion: "", total: 0 };
        FAC_COLUMNS.forEach(c => (parentRow[c] = 0));

        const hijosOrdenados = Object.keys(facMap[centroUniversitario]).sort((a, b) =>
          a.localeCompare(b, "es")
        );
        const hijosRows: any[] = [];

        for (const centroOperacion of hijosOrdenados) {
          const facs = facMap[centroUniversitario][centroOperacion];
          const childRow: any = { centro: centroOperacion, centroOperacion: centroUniversitario, total: 0, ...facs };

          FAC_COLUMNS.forEach(c => {
            childRow.total += facs[c];
            parentRow[c] += facs[c];
            totalGeneral[c] += facs[c];
          });
          hijosRows.push(childRow);
        }

        parentRow.total = FAC_COLUMNS.reduce((s, c) => s + parentRow[c], 0);
        escuelaRows.push(parentRow, ...hijosRows);
      }

      const totalRow: any = { centro: "Total", centroOperacion: "", total: 0 };
      FAC_COLUMNS.forEach(c => {
        totalRow[c] = totalGeneral[c];
        totalRow.total += totalGeneral[c];
      });
      escuelaRows.push(totalRow);
      setByEscuela(escuelaRows);

      // ── Ausentismo ──
      const ausMap: Record<string, { aus: number; des: number; total: number }> = {};

      rows.forEach(r => {
        const mod = mapModalidad(r.categoria);
        if (!ausMap[mod]) ausMap[mod] = { aus: 0, des: 0, total: 0 };
        const nuevos = r.nuevos ?? 0;
        const continuos = r.continuos ?? 0;
        const totales = r.totales ?? 0;
        ausMap[mod].aus += Math.max(nuevos - continuos, 0);
        ausMap[mod].des += Math.max(totales - continuos, 0);
        ausMap[mod].total += totales;
      });

      const totalAus = Object.values(ausMap).reduce(
        (a, b) => ({ aus: a.aus + b.aus, des: a.des + b.des, total: a.total + b.total }),
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
      const centrosCount = new Set(rows.map(r => r.centro)).size;
      const modalidadesCount = new Set(rows.map(r => r.categoria)).size;
      const programasCount = new Set(rows.map(r => r.programa)).size;

      setStats({ estudiantes, centros: centrosCount, modalidades: modalidadesCount, programas: programasCount });

      // ── Tendencia ──
      const trendMap: Record<string, number> = {};
      rows.forEach(r => {
        const key = r.fecha ?? "";
        if (!key) return;
        trendMap[key] = (trendMap[key] ?? 0) + (r.totales ?? 0);
      });

      setTrend(
        Object.entries(trendMap)
          .map(([fecha, valor]) => ({ fecha, valor }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
      );

      // ── Modalidad + Nivel ──
      const modalMap: any = {};
      rows.forEach(r => {
        const key = `${r.nivelAcademico}|${r.categoria}`;
        if (!modalMap[key]) {
          modalMap[key] = {
            nivelAcademico: r.nivelAcademico,
            categoria: r.categoria,
            nuevos: 0, continuos: 0, totales: 0,
          };
        }
        modalMap[key].nuevos    += r.nuevos    ?? 0;
        modalMap[key].continuos += r.continuos ?? 0;
        modalMap[key].totales   += r.totales   ?? 0;
      });

      setModalidadBreakdown(Object.values(modalMap));

    } catch (e: any) {
      setErr(e.message || "Error cargando datos");
    } finally {
      setIsLoading(false);
    }
  };

const forceRefresh = async () => {
  setIsLoading(true);
  setErr(null);
 
  try {
    // 1. Lanza warmup en backend (conecta Azure y recarga Redis)
    await fetch(`${API_URL}/api/cache/warmup`, { method: 'POST', headers: {
       'x-admin-key': ADMIN_KEY  // solo admin tiene esta clave
    }
    });
 
    // 2. Polling hasta que el warmup termine (máx 60s)
    const maxWait  = 60_000;
    const interval = 2_000;
    const start    = Date.now();
 
    await new Promise<void>((resolve) => {
      const check = async () => {
        try {
          const r = await fetch(`${API_URL}/api/cache/warmup-status`);
          const { done, entries } = await r.json();
          if ((done && entries > 0) || Date.now() - start > maxWait) {
            resolve();
          } else {
            setTimeout(check, interval);
          }
        } catch {
          resolve();
        }
      };
      setTimeout(check, interval);
    });
 
    // 3. Recargar combos con los datos frescos de Redis
    const all = await fetchAzureData();
    if (all && all.length > 0) {
      const periodicidades = [...new Set(
        all.map(d => (d.periodicidad ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const nivelesFormacion = [...new Set(
        all.map(d => (d.nivelFormacion ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const facultades = [...new Set(
        all.map(d => (d.facultad ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const periodosCombinados = [...new Set(
        all
          .map(d => (d.fecha && d.periodo) ? `${d.fecha}-${d.periodo}` : '')
          .filter(Boolean)
      )].sort((a, b) => b.localeCompare(a));
 
      const sedes = [...new Set(
        all.map(d => (d.rectoria ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const programas = [...new Set(
        all.map(d => (d.programa ?? d.siglasPrograma ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      setListaProgramas(programas.map(p => ({ label: p, value: p })));
 
      const modalidades = [...new Set(
        all.map(d => (d.categoria ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const niveles = [...new Set(
        all.map(d => normalizeNivel(d.nivelAcademico))
      )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
 
      const centros = [...new Set(
        all.map(d => (d.centro ?? '').toString().trim()).filter(Boolean)
      )].sort((a, b) => {
        const indexA = ORDEN_CENTROS.indexOf(a);
        const indexB = ORDEN_CENTROS.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, 'es', { sensitivity: 'base' });
      });
 
      setBase(prev => ({
        ...prev,
        modalidades,
        niveles,
        periodos: periodosCombinados,
        sufijoPeriodos: getSufijos(periodosCombinados),
        centros,
        periodicidades,
        nivelesFormacion,
        facultades,
        sedes,
      }));
    }
 
    // 4. Recargar dashboard
    await loadDashboard();
 
  } catch (e: any) {
    setErr(e.message || 'Error al actualizar');
    setIsLoading(false);
  }
};

  // ==================== ACCIONES ====================
  
  // ── CAMBIO: limpiar cada conjunto por separado ──
const clearDash = () => {
  setDashYears([base.years[0] ?? "2026"]);
  setDashModalidades([]);
  setDashNiveles([]);
  setDashPeriodos([]);
  setDashCentros([]);
};

const clearExec = () => {
  setExecYears([base.years[0] ?? "2026"]);
  setExecModalidades([]);
  setExecNivelFormacion([]);
  setExecPeriodos([]);
  setExecCentros([]);
  setExecProgramas([]);
};

const clearProj = () => {
  setProjYears(["2026"]);
  setProjModalidades([]);
  setProjNiveles([]);
  setProjPeriodos([]);
  setProjCentros([]);
  setProjPeriodicidades([]);
  setProjNivelesFormacion([]);
  setProjSedes([]);
  setProjFacultades([]);
};
  

  // ==================== KEY para forzar remount de DashboardCharts ====================
  const dashboardKey = `dash-${stats?.estudiantes ?? 0}-${byCentro.length}-${byEscuela.length}`;

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen flex flex-col">

      {/* HEADER — sticky solo él */}
      <header className="sticky top-0 z-50 bg-white border-b px-3 py-2 flex flex-wrap items-center justify-between gap-2">

        {/* LOGO */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/Logo Bogotá 2.png"
            alt="Uniminuto"
            className="h-10 sm:h-16 object-contain"
          />
          <div className="leading-tight truncate">
            <h1 className="text-xs sm:text-sm font-bold text-gray-800">360 Resumen</h1>
            <p className="text-[9px] sm:text-[10px] text-gray-500">UNIMINUTO • 2026</p>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex gap-2">
          
{/* Botón Actualizar — solo admin */}
{isAdmin ? (
  <button
    onClick={forceRefresh}
    className="bg-blue-600 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium hover:bg-blue-700"
  >
    <RefreshCw size={15} />
    Actualizar
  </button>
) : (
  <button
    onClick={() => setShowLoginModal(true)}
    className="bg-gray-200 text-gray-500 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-300"
  >
    🔒 Admin
  </button>
)}
           {/* ✅ BOTÓN 360 — agregar aquí */}
  <button
    onClick={() => window.open(
      "https://uniminuto0.sharepoint.com/:u:/r/sites/G-360/SitePages/TrainingHome.aspx?csf=1&web=1&e=xgeBy9",
      "_blank"
    )}
    className="bg-slate-800 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:bg-slate-700"
  >
    <Gauge size={15} /> 360
  </button>


{/* Modal login admin */}
{showLoginModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-80 flex flex-col gap-4 shadow-xl">
      <h2 className="font-bold text-gray-800">Acceso Administrador</h2>
      <input
        type="password"
        placeholder="Clave de administrador"
        value={adminInput}
        onChange={e => setAdminInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
        className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setShowLoginModal(false); setAdminInput(''); setLoginError(''); }}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
        >
          Cancelar
        </button>
        <button
          onClick={handleAdminLogin}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Entrar
        </button>
      </div>
    </div>
  </div>
)}
        </div>

        {/* TABS — scroll horizontal en móvil, sin wrap */}
        <div className="w-full overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="flex gap-1.5 sm:justify-center" style={{ width: "max-content", minWidth: "100%" }}>
            {["estudiantes", "colaboradores", "comparativos", "oferta", "investigacion"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs capitalize transition whitespace-nowrap ${
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

      </header>

      {/* MARQUEE */}
      <div className="sticky top-[56px] sm:top-[80px] z-40 bg-slate-900 text-white text-xs overflow-hidden border-y">
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
      <main className="flex-1 px-3 py-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">

          {/* STATUS */}
          <div className="flex justify-between text-[11px]">
            {err && <span className="text-red-500">{err}</span>}
            {isLoading && <span className="text-gray-500">Cargando…</span>}
          </div>

          {/* CONTENEDOR PRINCIPAL */}
          <div className="bg-white rounded-xl shadow-sm p-3 flex flex-col">

            {/* BOTÓN PARETO */}
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
            <div>

              {/* TAB: ESTUDIANTES */}
              {activeTab === "estudiantes" && (
                <div className="flex flex-col gap-3">

                  {/* DASHBOARD */}
                  {subViewEstudiantes !== "pareto" && (
                    <DashboardCharts
                      key={dashboardKey}
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
                            periodos={base.sufijoPeriodos.map(p => ({ label: p, value: p }))}
                            centros={base.centros.map(c => ({ label: c, value: c }))}
                            selYears={dashYears}          setSelYears={setDashYears}
                            selModalidades={dashModalidades} setSelModalidades={setDashModalidades}
                            selNiveles={dashNiveles}      setSelNiveles={setDashNiveles}
                            selPeriodos={dashPeriodos}    setSelPeriodos={setDashPeriodos}
                            selCentros={dashCentros}      setSelCentros={setDashCentros}
                            clearAll={clearDash}
                          />
                        }
                    />
                  )}

                  {/* PARETO */}
                  {subViewEstudiantes === "pareto" && (
                    <>
                      {subViewPareto === "proyectado" ? (
                      
                      <ParetoProyectado
                        fechaCorte={fechaCorte}
                        base={{ ...base, periodos: base.sufijoPeriodos }}
                        listaProgramas={listaProgramas}
                        pareto80={pareto80}
                        pareto20={pareto20}
                        selYears={projYears}                setSelYears={setProjYears}
                        selModalidades={projModalidades}      setSelModalidades={setProjModalidades}
                        selNiveles={projNiveles}              setSelNiveles={setProjNiveles}
                        selNivelFormacion={projNivelesFormacion} setSelNivelFormacion={setProjNivelesFormacion}
                        selPeriodos={projPeriodos}            setSelPeriodos={setProjPeriodos}
                        selCentros={projCentros}              setSelCentros={setProjCentros}
                        selPeriodicidades={projPeriodicidades} setSelPeriodicidades={setProjPeriodicidades}
                        selNivelesFormacion={projNivelesFormacion} setSelNivelesFormacion={setProjNivelesFormacion}
                        selSedes={projSedes}                  setSelSedes={setProjSedes}
                        selFacultades={projFacultades}        setSelFacultades={setProjFacultades}
                        selProgramas={[]}  setSelProgramas={() => {}}
                        dataChartPregrado={dataChartPregrado}        
                        dataChartPosgrado={dataChartPosgrado}
                        clearAll={clearProj}
                        onVolver={() => setSubViewEstudiantes("dashboard")}
                        onIrEjecutado={() => setSubViewPareto("ejecutado")}
                      />

                      ) : (

                        <div className="flex flex-col gap-4">

                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <button
                              onClick={() => setSubViewPareto("proyectado")}
                              className="px-4 py-2 text-sm font-medium rounded-md shadow bg-yellow-400 text-black hover:bg-yellow-500 transition whitespace-nowrap"
                            >
                              Pareto proyectado
                            </button>
                            <div className="flex-1 w-full text-center">
                              <h2 className="text-[11px] sm:text-sm md:text-base font-bold text-white bg-slate-700 px-3 sm:px-6 py-2 rounded-md text-center break-words w-full mx-auto">
                                SEDE UNIMINUTO BOGOTÁ / PARETO EJECUTADO
                              </h2>
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <FiltersMulti
                                  years={base.years.map(y => ({ label: y, value: y }))}
                                  modalidades={base.modalidades.map(m => ({ label: m, value: m }))}
                                  niveles={[]}
                                  selNiveles={[]} setSelNiveles={() => {}}
                                  nivelesFormacion={base.nivelesFormacion.map(n => ({ label: n, value: n }))}
                                  selNivelesFormacion={execNivelFormacion}
                                  setSelNivelesFormacion={setExecNivelFormacion}
                                  periodos={base.sufijoPeriodos.map(p => ({ label: p, value: p }))}
                                  centros={base.centros.map(c => ({ label: c, value: c }))}
                                  programas={listaProgramas}
                                  selProgramas={execProgramas}    setSelProgramas={setExecProgramas}
                                  selYears={execYears}            setSelYears={setExecYears}
                                  selModalidades={execModalidades} setSelModalidades={setExecModalidades}
                                  selPeriodos={execPeriodos}      setSelPeriodos={setExecPeriodos}
                                  selCentros={execCentros}        setSelCentros={setExecCentros}
                                  dataChartPregrado={dataChartPregrado}
                                  dataChartPosgrado={dataChartPosgrado}
                                  clearAll={clearExec}
                                />
                          </div>


<div className="flex flex-col gap-4">

  {/* PREGRADO */}
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">

    <Panel title="Tabla Pareto Pregrado">
      <ParetoTablas
        pareto80={{ pregrado: pareto80.pregrado, posgrado: [] }}
        pareto20={{ pregrado: pareto20.pregrado, posgrado: [] }}
      />
    </Panel>

    <Panel title="Gráfica Pareto Pregrado">
      <GraficaPareto
        titulo="Pregrado — Pareto de programas en relación a estudiantes nuevos"
        colorHeader="bg-slate-700"
        data={dataChartPregrado}
      />
    </Panel>

  </div>

  {/* POSGRADO */}
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">

    <Panel title="Tabla Pareto Posgrado">
      <ParetoTablas
        pareto80={{ pregrado: [], posgrado: pareto80.posgrado }}
        pareto20={{ pregrado: [], posgrado: pareto20.posgrado }}
      />
    </Panel>

    <Panel title="Gráfica Pareto Posgrado">
      <GraficaPareto
        titulo="Posgrado — Pareto de programas en relación a estudiantes nuevos"
        colorHeader="bg-purple-700"
        data={dataChartPosgrado}
      />
    </Panel>

  </div>

</div>

</div>
                      </div>
                      )}
                    </>
                  )}

                </div>
              )}

              {/* OTROS TABS */}
              {activeTab === "colaboradores" && <ColaboradoresView />}
              {activeTab === "comparativos" && <ComparativosView />}
              {activeTab === "oferta" && <OfertaView fechaCorte={fechaCorte} />}
              {activeTab === "investigacion" && <InvestigacionView />}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}

export default App;
