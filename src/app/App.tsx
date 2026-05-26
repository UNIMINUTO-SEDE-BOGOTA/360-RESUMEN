// src/App.tsx — OPTIMIZADO
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshCw, Gauge } from "lucide-react";
import { FiltersMulti } from "./components/FiltersMulti";
import { DashboardCharts } from "./components/DashboardCharts";
import { virtual2026S1Data } from "./data/virtual2026S1Data";
import {
  fetchAzureData,
  fetchTableMulti,
  FiltersMulti as F,
} from "./services/azureService";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { ParetoProyectado } from "./components/ParetoProyectado";

// ── Lazy imports para tabs que no se usan al inicio ──
const ColaboradoresView = lazy(() => import("./components/ColaboradoresView"));
const ComparativosView  = lazy(() => import("./components/ComparativosView"));
const OfertaView        = lazy(() => import("./components/OfertaView").then(m => ({ default: m.OfertaView })));

// ── Hooks personalizados ──
import { useIsMobile }   from "./hooks/useIsMobile";
import { useDebounce }   from "./hooks/useDebounce";
import { useVirtualRows } from "./hooks/useVirtualRows";

// ==================== CONFIG ====================

const API_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  "https://three60-resumen-backend.onrender.com";

// ── Cache de combos en sessionStorage ──
const COMBOS_CACHE_KEY = "filtros_base_v2";

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
  "San Cristóbal Norte - Usaquén",
];

const cleanStr = (t: string) => (t || "").trim().toLowerCase();

// ==================== HELPERS ====================

const normalizeNivel = (nivel: string): string => {
  const n = (nivel || "").toString().toLowerCase().trim();
  if (
    n.includes("posgrado") ||
    n.includes("especial") ||
    n.includes("maestr") ||
    n.includes("doctor")
  )
    return "Posgrado";
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

// ==================== LOADING FALLBACK ====================

const TabLoading = () => (
  <div className="flex items-center justify-center h-40 text-sm text-gray-400">
    Cargando…
  </div>
);

// ==================== APP ====================

function App() {
  // ── Hooks personalizados ──
  const isMobile = useIsMobile();

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
    sedes: [],
  });

  const fechaCorte = "20 de marzo de 2026";

  // ── Navegación ──
  const [activeTab, setActiveTab]           = useState("estudiantes");
  const [subViewEstudiantes, setSubViewEstudiantes] = useState<"dashboard" | "pareto">("dashboard");
  const [subViewPareto, setSubViewPareto]   = useState<"ejecutado" | "proyectado">("ejecutado");

  // ── Selecciones de filtros ──
  const [selYears,           setSelYears]           = useState<string[]>([]);
  const [selModalidades,     setSelModalidades]     = useState<string[]>([]);
  const [selNiveles,         setSelNiveles]         = useState<string[]>([]);
  const [selPeriodos,        setSelPeriodos]        = useState<string[]>([]);
  const [selCentros,         setSelCentros]         = useState<string[]>([]);
  const [selNivelFormacion,  setSelNivelFormacion]  = useState<string[]>([]);
  const [selProgramas,       setSelProgramas]       = useState<string[]>([]);
  const [selPeriodicidades,  setSelPeriodicidades]  = useState<string[]>([]);
  const [selNivelesFormacion,setSelNivelesFormacion]= useState<string[]>([]);
  const [selSedes,           setSelSedes]           = useState<string[]>([]);
  const [selFacultades,      setSelFacultades]      = useState<string[]>([]);

  // ── Datos del dashboard ──
  const [stats,              setStats]              = useState<StatsData | null>(null);
  const [modalidadBreakdown, setModalidadBreakdown] = useState<BreakdownItem[]>([]);
  const [trend,              setTrend]              = useState<any[]>([]);
  const [ausDes,             setAusDes]             = useState<any[]>([]);
  const [byCentro,           setByCentro]           = useState<any[]>([]);
  const [byEscuela,          setByEscuela]          = useState<any[]>([]);
  const [virtual2026S1,      setVirtual2026S1]      = useState<any[]>([]);

  // ── Pareto ──
  const [paretoData,     setParetoData]     = useState<ParetoItem[]>([]);
  const [pareto80,       setPareto80]       = useState<ParetoItem[]>([]);
  const [pareto20,       setPareto20]       = useState<ParetoItem[]>([]);
  const [listaProgramas, setListaProgramas] = useState<{ label: string; value: string }[]>([]);
  const [highlightBar,   setHighlightBar]   = useState(false);
  const [highlightLine,  setHighlightLine]  = useState(false);

  // ── UI ──
  const [isLoading, setIsLoading] = useState(true);
  const [err,       setErr]       = useState<string | null>(null);
  const reqId = useRef(0);

  // ── Virtualización de tablas pareto ──
  const vPareto80 = useVirtualRows(pareto80, 28, 15);
  const vPareto20 = useVirtualRows(pareto20, 28, 15);

  // ==================== PARSED YEARS / PERIODOS ====================

  const { parsedYears, parsedPeriodos } = useMemo(() => {
    const years: string[]   = [];
    const periodos: string[] = [];
    selPeriodos.forEach((p) => {
      if (p.includes("-")) {
        const idx    = p.indexOf("-");
        const year   = p.slice(0, idx);
        const periodo = p.slice(idx + 1);
        if (/^\d{4}$/.test(year)) years.push(year);
        if (periodo) periodos.push(periodo);
      } else {
        periodos.push(p);
      }
    });
    return {
      parsedYears:   [...new Set(years)],
      parsedPeriodos: [...new Set(periodos)],
    };
  }, [selPeriodos]);

  // ==================== DEBOUNCE FILTROS ====================
  // Agrupa todos los filtros en un objeto y lo debouncéa para evitar
  // múltiples llamadas seguidas al cambiar varios combos.

  const rawFilters = useMemo(
    () => ({
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
      subViewEstudiantes,
    }),
    [
      selYears, selModalidades, selNiveles, selPeriodos, selCentros,
      selPeriodicidades, selNivelFormacion, selProgramas, selSedes,
      selFacultades, subViewEstudiantes,
    ]
  );

  const debouncedFilters = useDebounce(rawFilters, 350);

  // ==================== CARGA BASE DE COMBOS ====================

  // 1) Años desde el backend
  useEffect(() => {
    (async () => {
      try {
        const res   = await fetch(`${API_URL}/api/filtros/years`);
        const years = await res.json();
        setBase((prev) => ({ ...prev, years }));
      } catch (e) {
        console.error("Error cargando años:", e);
      }
    })();
  }, []);

  // 2) Selección inicial: el año más reciente
  useEffect(() => {
    if (!base.years || base.years.length === 0) return;
    setSelYears((prev) => {
      if (prev.length > 0 && prev.every((y) => base.years.includes(y))) return prev;
      return [base.years[0]];
    });
  }, [base.years]);

  // 3) Resto de combos — con caché en sessionStorage
  useEffect(() => {
    (async () => {
      try {
        // ── Intentar caché primero ──
        const cached = sessionStorage.getItem(COMBOS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setBase((prev) => ({ ...prev, ...parsed }));
          setListaProgramas(parsed._programas ?? []);
          return;
        }

        const all = await fetchAzureData();

        const uniq = (key: string) =>
          [...new Set(all.map((d: any) => (d[key] ?? "").toString().trim()).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          );

        const periodicidades     = uniq("periodicidad");
        const nivelesFormacion   = uniq("nivelFormacion");
        const facultades         = uniq("facultad");
        const sedes              = uniq("rectoria");
        const modalidades        = uniq("categoria");

        const periodosCombinados = [
          ...new Set(
            all
              .map((d: any) => (d.fecha && d.periodo) ? `${d.fecha}-${d.periodo}` : "")
              .filter(Boolean)
          ),
        ].sort((a, b) => b.localeCompare(a));

        const programas = [
          ...new Set(
            all.map((d: any) => (d.programa ?? d.siglasPrograma ?? "").toString().trim()).filter(Boolean)
          ),
        ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const niveles = [
          ...new Set(all.map((d: any) => normalizeNivel(d.nivelAcademico))),
        ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const centros = [
          ...new Set(all.map((d: any) => (d.centro ?? "").toString().trim()).filter(Boolean)),
        ].sort((a, b) => {
          const iA = ORDEN_CENTROS.indexOf(a);
          const iB = ORDEN_CENTROS.indexOf(b);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return a.localeCompare(b, "es", { sensitivity: "base" });
        });

        const programasOpts = programas.map((p) => ({ label: p, value: p }));

        const opciones = {
          modalidades,
          niveles,
          periodos: periodosCombinados,
          centros,
          periodicidades,
          nivelesFormacion,
          facultades,
          sedes,
          _programas: programasOpts,
        };

        // ── Guardar en caché ──
        try {
          sessionStorage.setItem(COMBOS_CACHE_KEY, JSON.stringify(opciones));
        } catch (_) {
          // sessionStorage lleno — no es crítico
        }

        setListaProgramas(programasOpts);
        setBase((prev) => ({ ...prev, ...opciones }));
      } catch (e) {
        console.error("Error cargando combos:", e);
      }
    })();
  }, []);

  // Reset subview al cambiar de tab
  useEffect(() => {
    if (activeTab !== "estudiantes") setSubViewEstudiantes("dashboard");
  }, [activeTab]);

  // ==================== PARETO ====================

  const dataChart = useMemo(
    () =>
      paretoData.map((p) => ({
        ...p,
        fill: p.porcentaje <= 80 ? "#22c55e" : "#93c5fd",
      })),
    [paretoData]
  );

  // En móvil: limitar puntos del chart para no congelar SVG
  const chartDataLimited = useMemo(() => {
    const MAX = isMobile ? 20 : dataChart.length;
    return dataChart.slice(0, MAX);
  }, [dataChart, isMobile]);

  const buildPareto = useCallback((data: any[]) => {
    const map: Record<string, number> = {};
    data.forEach((d) => {
      const programa = d.programa || d.programaAcademico || d.nombrePrograma || "Sin nombre";
      const valor    = d.nuevos ?? d.estudiantes ?? d.total ?? 0;
      if (!programa || valor === 0) return;
      map[programa] = (map[programa] || 0) + valor;
    });

    const arr = Object.entries(map)
      .map(([programa, valor]) => ({ programa, valor, acumulado: 0, porcentaje: 0 }))
      .sort((a, b) => b.valor - a.valor);

    const total = arr.reduce((acc, cur) => acc + cur.valor, 0);
    let acumulado = 0;
    arr.forEach((item) => {
      acumulado      += item.valor;
      item.acumulado  = acumulado;
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
  }, []);

  const loadPareto = useCallback(async () => {
    try {
      const filters = {
        years:           parsedYears.length ? parsedYears : selYears,
        modalidades:     selModalidades,
        niveles:         selNiveles,
        nivelesFormacion: selNivelFormacion.length ? selNivelFormacion : undefined,
        periodos:        parsedPeriodos,
        centros:         selCentros,
        programas:       selProgramas,
        periodicidades:  selPeriodicidades,
        sedes:           selSedes,
        facultades:      selFacultades,
      };
      const res = await fetchTableMulti(filters);
      buildPareto(res.rows);
    } catch (e) {
      console.error("Error cargando pareto:", e);
    }
  }, [
    parsedYears, selYears, selModalidades, selNiveles, selNivelFormacion,
    parsedPeriodos, selCentros, selProgramas, selPeriodicidades, selSedes,
    selFacultades, buildPareto,
  ]);

  // ==================== DASHBOARD ====================

  const loadDashboard = useCallback(async () => {
    const currentReqId = ++reqId.current;
    setIsLoading(true);
    setErr(null);

    try {
      const res  = await fetchTableMulti({
        years:      selYears,
        modalidades: selModalidades,
        niveles:    selNiveles,
        periodos:   selPeriodos.length ? parsedPeriodos : [],
        centros:    selCentros,
        pageSize:   10000,
      });

      // Ignorar respuesta si llegó otra petición más nueva
      if (currentReqId !== reqId.current) return;

      const rows = res.rows;

      // ── byCentro ──
      const centroMap: Record<string, any> = {};

      rows.forEach((r: any) => {
        const centroUniversitario = r.centro || "Sin centro";
        const centroOperacionRaw  = r.centroOperacion?.trim();
        const centroOperacion     =
          centroOperacionRaw && centroOperacionRaw.length > 0
            ? centroOperacionRaw
            : null;
        const modalidad = mapModalidad(r.categoria);

        if (!centroMap[centroUniversitario]) {
          centroMap[centroUniversitario] = {
            categoria: centroUniversitario,
            nuevos: 0, continuos: 0, total: 0,
            operaciones: {},
          };
        }

        const opKey = centroOperacion ?? "__SIN_OPERACION__";
        if (!centroMap[centroUniversitario].operaciones[opKey]) {
          centroMap[centroUniversitario].operaciones[opKey] = {
            nombre: centroOperacion ?? "",
            nuevos: 0, continuos: 0, total: 0,
            modalidades: {},
          };
        }

        if (!centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad]) {
          centroMap[centroUniversitario].operaciones[opKey].modalidades[modalidad] = {
            nombre: modalidad, nuevos: 0, continuos: 0, total: 0,
          };
        }

        const nuevos    = r.nuevos   ?? 0;
        const continuos = r.continuos ?? 0;
        const totales   = r.totales  ?? 0;

        centroMap[centroUniversitario].nuevos    += nuevos;
        centroMap[centroUniversitario].continuos += continuos;
        centroMap[centroUniversitario].total     += totales;

        const op = centroMap[centroUniversitario].operaciones[opKey];
        op.nuevos    += nuevos;
        op.continuos += continuos;
        op.total     += totales;

        const mod = op.modalidades[modalidad];
        mod.nuevos    += nuevos;
        mod.continuos += continuos;
        mod.total     += totales;
      });

      const ordenarCentros = (lista: any[]) =>
        lista.sort((a, b) => {
          const iA = ORDEN_CENTROS.indexOf(a.categoria);
          const iB = ORDEN_CENTROS.indexOf(b.categoria);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return a.categoria.localeCompare(b.categoria, "es");
        });

      setByCentro(
        ordenarCentros(
          Object.values(centroMap).map((c: any) => ({
            categoria:  c.categoria,
            nuevos:     c.nuevos,
            continuos:  c.continuos,
            total:      c.total,
            operaciones: Object.values(c.operaciones).map((o: any) => ({
              nombre:    o.nombre,
              nuevos:    o.nuevos,
              continuos: o.continuos,
              total:     o.total,
              modalidades: Object.values(o.modalidades),
            })),
          }))
        )
      );

      // ── byEscuela ──
      const FAC_COLUMNS = ["FCCO", "FCEM", "FCHS", "FCSA", "FEBPE", "FEDU", "FING"] as const;
      const facMap: Record<string, Record<string, Record<string, number>>> = {};

      rows.forEach((r: any) => {
        const centroUniversitario = r.centro || "Sin centro";
        const centroOperacionRaw  = r.centroOperacion?.trim();
        const centroOperacion     =
          centroOperacionRaw && centroOperacionRaw.length > 0
            ? centroOperacionRaw
            : centroUniversitario;

        const fac   = getFacSigla(r.facultad);
        const valor = r.totales ?? 0;
        if (!fac || valor === 0) return;

        if (!facMap[centroUniversitario])                      facMap[centroUniversitario] = {};
        if (!facMap[centroUniversitario][centroOperacion])     facMap[centroUniversitario][centroOperacion] = { FCCO: 0, FCEM: 0, FCHS: 0, FCSA: 0, FEBPE: 0, FEDU: 0, FING: 0 };

        facMap[centroUniversitario][centroOperacion][fac] += valor;
      });

      const escuelaRows: any[] = [];
      const totalGeneral: Record<string, number> = {};
      FAC_COLUMNS.forEach((c) => (totalGeneral[c] = 0));

      const centrosOrdenados = Object.keys(facMap).sort((a, b) => {
        const iA = ORDEN_CENTROS.findIndex((x) => cleanStr(x) === cleanStr(a));
        const iB = ORDEN_CENTROS.findIndex((x) => cleanStr(x) === cleanStr(b));
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b, "es");
      });

      for (const centroUniversitario of centrosOrdenados) {
        const parentRow: any = { centro: centroUniversitario, centroOperacion: "", total: 0 };
        FAC_COLUMNS.forEach((c) => (parentRow[c] = 0));

        const hijosOrdenados = Object.keys(facMap[centroUniversitario]).sort((a, b) =>
          a.localeCompare(b, "es")
        );
        const hijosRows: any[] = [];

        for (const centroOperacion of hijosOrdenados) {
          const facs     = facMap[centroUniversitario][centroOperacion];
          const childRow: any = { centro: centroOperacion, centroOperacion: centroUniversitario, total: 0, ...facs };
          FAC_COLUMNS.forEach((c) => {
            childRow.total     += facs[c];
            parentRow[c]       += facs[c];
            totalGeneral[c]    += facs[c];
          });
          hijosRows.push(childRow);
        }

        parentRow.total = FAC_COLUMNS.reduce((s, c) => s + parentRow[c], 0);
        escuelaRows.push(parentRow, ...hijosRows);
      }

      const totalRow: any = { centro: "Total", centroOperacion: "", total: 0 };
      FAC_COLUMNS.forEach((c) => {
        totalRow[c]     = totalGeneral[c];
        totalRow.total += totalGeneral[c];
      });
      escuelaRows.push(totalRow);
      setByEscuela(escuelaRows);

      // ── Ausentes / Desertores ──
      const ausMap: Record<string, { aus: number; des: number; total: number }> = {};
      rows.forEach((r: any) => {
        const mod = mapModalidad(r.categoria);
        if (!ausMap[mod]) ausMap[mod] = { aus: 0, des: 0, total: 0 };
        const nuevos    = r.nuevos   ?? 0;
        const continuos = r.continuos ?? 0;
        const totales   = r.totales  ?? 0;
        ausMap[mod].aus   += Math.max(nuevos - continuos, 0);
        ausMap[mod].des   += Math.max(totales - continuos, 0);
        ausMap[mod].total += totales;
      });

      const totalAus = Object.values(ausMap).reduce(
        (a, b) => ({ aus: a.aus + b.aus, des: a.des + b.des, total: a.total + b.total }),
        { aus: 0, des: 0, total: 0 }
      );

      setAusDes([
        ...Object.entries(ausMap).map(([modalidad, v]) => ({
          modalidad,
          ausentes:       v.aus,
          pct_ausentes:   v.total ? (v.aus / v.total) * 100 : 0,
          desertores:     v.des,
          pct_desertores: v.total ? (v.des / v.total) * 100 : 0,
        })),
        {
          modalidad:      "UNIMINUTO Bogotá",
          ausentes:       totalAus.aus,
          pct_ausentes:   totalAus.total ? (totalAus.aus / totalAus.total) * 100 : 0,
          desertores:     totalAus.des,
          pct_desertores: totalAus.total ? (totalAus.des / totalAus.total) * 100 : 0,
        },
      ]);

      // ── Virtual 2026-S1 ──
      setVirtual2026S1(
        virtual2026S1Data.filter((v) => v.ano === "2026" && v.periodo === "2026-1")
      );

      // ── KPIs ──
      setStats({
        estudiantes:  rows.reduce((a: number, b: any) => a + (b.totales ?? 0), 0),
        centros:      new Set(rows.map((r: any) => r.centro)).size,
        modalidades:  new Set(rows.map((r: any) => r.categoria)).size,
        programas:    new Set(rows.map((r: any) => r.programa)).size,
      });

      // ── Tendencia por año ──
      const trendMap: Record<string, number> = {};
      rows.forEach((r: any) => {
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
      rows.forEach((r: any) => {
        const key = `${r.nivelAcademico}|${r.categoria}`;
        if (!modalMap[key]) {
          modalMap[key] = { nivelAcademico: r.nivelAcademico, categoria: r.categoria, nuevos: 0, continuos: 0, totales: 0 };
        }
        modalMap[key].nuevos    += r.nuevos    ?? 0;
        modalMap[key].continuos += r.continuos ?? 0;
        modalMap[key].totales   += r.totales   ?? 0;
      });
      setModalidadBreakdown(Object.values(modalMap));

    } catch (e: any) {
      if (currentReqId === reqId.current) {
        setErr(e.message || "Error cargando datos");
      }
    } finally {
      if (currentReqId === reqId.current) setIsLoading(false);
    }
  }, [selYears, selModalidades, selNiveles, selPeriodos, selCentros, parsedPeriodos]);

  const forceRefresh = async () => {
    // Limpiar caché de combos para forzar recarga
    sessionStorage.removeItem(COMBOS_CACHE_KEY);
    await fetch(`${API_URL}/api/cache/clear`, { method: "POST" });
    loadDashboard();
  };

  // ── Disparar carga con filtros debounceados ──
  useEffect(() => {
    if (debouncedFilters.subViewEstudiantes === "pareto") {
      loadPareto();
    } else {
      loadDashboard();
    }
  }, [debouncedFilters, loadDashboard, loadPareto]);

  // ==================== ACCIONES ====================

  const clearAll = useCallback(() => {
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
  }, [base.years]);

  // ==================== RENDER ====================

  return (
    <div className="sticky top-0 z-50 md:static">

      {/* ── HEADER ── */}
      <header className="bg-white border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">

        {/* LOGO */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/Logo Bogotá 2.png"
            alt="Uniminuto"
            className="h-16 object-contain"
            loading="eager"
          />
          <div className="leading-tight truncate">
            <h1 className="text-sm font-bold text-gray-800">360 Resumen</h1>
            <p className="text-[10px] text-gray-500">UNIMINUTO • 2020–2026</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2">
            {["estudiantes", "colaboradores", "comparativos", "oferta", "investigacion"].map((tab) => (
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
            onClick={() => window.open("", "_blank")}
            className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700"
          >
            <Gauge size={18} /> 360
          </button>
        </div>

      </header>

      {/* ── MARQUEE ── */}
      <div className="bg-slate-900 text-white text-xs overflow-hidden border-y">
        <div className="overflow-hidden">
          <div
            className="flex whitespace-nowrap"
            style={{ animation: "marquee 30s linear infinite", width: "max-content" }}
          >
            {[...Array(12)].map((_, i) => (
              <span key={i} className="px-6">
                Sistema Integrado de Información · Corte: {fechaCorte}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <main className="flex-1 px-3 py-3 overflow-y-auto">
        <div className="max-w-7xl mx-auto flex-1 min-h-0 flex flex-col gap-2">

          {/* STATUS */}
          <div className="flex justify-between text-[11px]">
            {err       && <span className="text-red-500">{err}</span>}
            {isLoading && <span className="text-gray-500">Cargando…</span>}
          </div>

          {/* CONTENEDOR PRINCIPAL */}
          <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm p-3 flex flex-col">

            {/* HEADER INTERNO — solo en pestaña estudiantes */}
            {activeTab === "estudiantes" && (
              <div className="flex justify-end items-center mb-2">
                <button
                  onClick={() =>
                    setSubViewEstudiantes((prev) =>
                      prev === "pareto" ? "dashboard" : "pareto"
                    )
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

            {/* ── CONTENIDO ── */}
            <div className="flex-1 min-h-0">

              {/* TAB: ESTUDIANTES */}
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
                          years={base.years.map((y) => ({ label: y, value: y }))}
                          modalidades={base.modalidades.map((m) => ({ label: m, value: m }))}
                          niveles={base.niveles.map((n) => ({ label: n, value: n }))}
                          periodos={base.periodos.map((p) => ({ label: p, value: p }))}
                          centros={base.centros.map((c) => ({ label: c, value: c }))}
                          selYears={selYears}         setSelYears={setSelYears}
                          selModalidades={selModalidades} setSelModalidades={setSelModalidades}
                          selNiveles={selNiveles}     setSelNiveles={setSelNiveles}
                          selPeriodos={selPeriodos}   setSelPeriodos={setSelPeriodos}
                          selCentros={selCentros}     setSelCentros={setSelCentros}
                          clearAll={clearAll}
                        />
                      }
                    />
                  )}

                  {/* PARETO */}
                  {subViewEstudiantes === "pareto" && (
                    <>
                      {subViewPareto === "proyectado" ? (

                        /* PARETO PROYECTADO */
                        <ParetoProyectado
                          fechaCorte={fechaCorte}
                          base={base}
                          listaProgramas={listaProgramas}
                          pareto80={pareto80}
                          pareto20={pareto20}
                          dataChart={dataChart}
                          selYears={selYears}                   setSelYears={setSelYears}
                          selModalidades={selModalidades}       setSelModalidades={setSelModalidades}
                          selNivelFormacion={selNivelFormacion} setSelNivelFormacion={setSelNivelFormacion}
                          selPeriodos={selPeriodos}             setSelPeriodos={setSelPeriodos}
                          selCentros={selCentros}               setSelCentros={setSelCentros}
                          selProgramas={selProgramas}           setSelProgramas={setSelProgramas}
                          selPeriodicidades={selPeriodicidades} setSelPeriodicidades={setSelPeriodicidades}
                          selNiveles={selNiveles}               setSelNiveles={setSelNiveles}
                          selNivelesFormacion={selNivelesFormacion} setSelNivelesFormacion={setSelNivelesFormacion}
                          selSedes={selSedes}                   setSelSedes={setSelSedes}
                          selFacultades={selFacultades}         setSelFacultades={setSelFacultades}
                          clearAll={clearAll}
                          onVolver={() => setSubViewEstudiantes("dashboard")}
                          onIrEjecutado={() => setSubViewPareto("ejecutado")}
                        />

                      ) : (

                        /* PARETO EJECUTADO */
                        <div className="flex flex-col gap-4 h-full min-h-0">

                          {/* HEADER */}
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                              <button
                                onClick={() => setSubViewPareto("proyectado")}
                                className="px-4 py-2 text-sm font-medium rounded-md shadow bg-yellow-400 text-black hover:bg-yellow-500 transition whitespace-nowrap"
                              >
                                Pareto proyectado
                              </button>
                            </div>
                            <div className="flex-1 w-full text-center">
                              <h2 className="text-[11px] sm:text-sm md:text-base font-bold text-white bg-slate-700 px-3 sm:px-6 py-2 rounded-md text-center break-words w-full sm:w-auto mx-auto">
                                SEDE UNIMINUTO BOGOTÁ / PARETO EJECUTADO
                              </h2>
                            </div>
                          </div>

                          {/* FILTROS PARETO EJECUTADO */}
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <FiltersMulti
                              years={base.years.map((y) => ({ label: y, value: y }))}
                              modalidades={base.modalidades.map((m) => ({ label: m, value: m }))}
                              niveles={[]}
                              selNiveles={[]}
                              setSelNiveles={() => {}}
                              nivelesFormacion={base.nivelesFormacion.map((n) => ({ label: n, value: n }))}
                              selNivelesFormacion={selNivelFormacion}
                              setSelNivelesFormacion={setSelNivelFormacion}
                              periodos={base.periodos.map((p) => ({ label: p, value: p }))}
                              centros={base.centros.map((c) => ({ label: c, value: c }))}
                              programas={listaProgramas}
                              selProgramas={selProgramas}
                              setSelProgramas={setSelProgramas}
                              selYears={selYears}         setSelYears={setSelYears}
                              selModalidades={selModalidades} setSelModalidades={setSelModalidades}
                              selPeriodos={selPeriodos}   setSelPeriodos={setSelPeriodos}
                              selCentros={selCentros}     setSelCentros={setSelCentros}
                              clearAll={clearAll}
                            />
                          </div>

                          {/* CONTENIDO PARETO EJECUTADO */}
                          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">

                            {/* COLUMNA IZQUIERDA: tablas virtualizadas */}
                            <div className="flex flex-col gap-3">

                              {/* TABLA 80% — virtualizada */}
                              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                  Programas que contienen el 80% de los estudiantes
                                </div>
                                <div
                                  className="overflow-y-auto"
                                  style={{ maxHeight: 224 }}
                                  onScroll={vPareto80.onScroll}
                                >
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa Académico</th>
                                        <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Est.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ height: vPareto80.paddingTop }} />
                                      {vPareto80.visible.map((p, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                          <td className="px-2 py-1 text-slate-400">
                                            {pareto80.indexOf(p) + 1}
                                          </td>
                                          <td className="px-2 py-1 text-slate-700">{p.programa}</td>
                                          <td className="px-2 py-1 text-right text-slate-700">{p.valor}</td>
                                        </tr>
                                      ))}
                                      <tr style={{ height: vPareto80.paddingBottom }} />
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50">
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

                              {/* TABLA 20% — virtualizada */}
                              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                  Programas que contienen el 20% de los estudiantes
                                </div>
                                <div
                                  className="overflow-y-auto"
                                  style={{ maxHeight: 224 }}
                                  onScroll={vPareto20.onScroll}
                                >
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
                                        <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa Académico</th>
                                        <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Est.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ height: vPareto20.paddingTop }} />
                                      {vPareto20.visible.map((p, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                          <td className="px-2 py-1 text-slate-400">
                                            {pareto20.indexOf(p) + 1}
                                          </td>
                                          <td className="px-2 py-1 text-slate-700">{p.programa}</td>
                                          <td className="px-2 py-1 text-right text-slate-700">{p.valor}</td>
                                        </tr>
                                      ))}
                                      <tr style={{ height: vPareto20.paddingBottom }} />
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50">
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

                            {/* GRÁFICA — limitada en móvil */}
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-700 text-white text-xs px-3 py-2 font-medium">
                                Pareto de programas en relación a estudiantes nuevos
                                {isMobile && chartDataLimited.length < dataChart.length && (
                                  <span className="ml-2 text-slate-300">
                                    (top {chartDataLimited.length})
                                  </span>
                                )}
                              </div>

                              <div className="p-2">
                                <div className="overflow-x-auto">
                                  <div
                                    style={{
                                      minWidth:  isMobile ? 600 : undefined,
                                      width:     isMobile ? undefined : "100%",
                                      height:    isMobile ? 350 : 500,
                                    }}
                                  >
                                    <ResponsiveContainer width="100%" height="100%">
                                      <ComposedChart
                                        data={chartDataLimited}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 80 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

                                        <XAxis
                                          dataKey="programa"
                                          tickFormatter={(value) =>
                                            isMobile ? value.slice(0, 10) + "…" : value
                                          }
                                          tick={{ fontSize: isMobile ? 7 : 9 }}
                                          interval={isMobile ? 1 : 0}
                                          angle={isMobile ? -90 : -45}
                                          textAnchor="end"
                                          height={isMobile ? 120 : 90}
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
                                            if (value === "valor")     return "Estudiantes Nuevos";
                                            return value;
                                          }}
                                          onClick={(e) => {
                                            if (e.dataKey === "porcentaje") setHighlightLine((p) => !p);
                                            else setHighlightBar((p) => !p);
                                          }}
                                        />

                                        <Tooltip
                                          formatter={(value, name) => {
                                            if (name === "valor")     return [`${Number(value).toLocaleString()}`, "Estudiantes Nuevos"];
                                            if (name === "porcentaje") return [`${Number(value).toFixed(2)}%`, "Pareto Nuevos"];
                                            return [value, name];
                                          }}
                                        />

                                        <Bar yAxisId="left" dataKey="valor" name="Estudiantes Nuevos">
                                          {chartDataLimited.map((entry, index) => {
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
                                          dot={isMobile ? false : { r: highlightLine ? 3.5 : 2, fill: highlightLine ? "#1e3a8a" : "#1d4ed8" }}
                                          label={
                                            isMobile
                                              ? false
                                              : {
                                                  position: "top",
                                                  fontSize: 8,
                                                  fill: highlightLine ? "#1e3a8a" : "#1d4ed8",
                                                  formatter: (v: number) => `${v.toFixed(1)}%`,
                                                }
                                          }
                                        />

                                      </ComposedChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}

              {/* OTROS TABS — lazy cargados */}
              <Suspense fallback={<TabLoading />}>
                {activeTab === "colaboradores" && <ColaboradoresView />}
                {activeTab === "comparativos"  && <ComparativosView />}
                {activeTab === "oferta"        && <OfertaView fechaCorte={fechaCorte} />}
              </Suspense>

              {activeTab === "investigacion" && (
                <div className="h-full w-full">
                  <iframe
                    title="Investigacion Power BI"
                    src="https://app.powerbi.com/view?r=eyJrIjoiNmI4OTU2YTItZDdkMy00ZDU4LWJkMzgtYTM5Yzc1MDUyYzUxIiwidCI6ImIxYmE4NWViLWEyNTMtNDQ2Ny05ZWU4LWQ0ZjhlZDRkZjMwMCIsImMiOjR9"
                    className="w-full h-[calc(100vh-180px)] rounded-md border"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              )}

              {activeTab === "360" && (
                <div className="h-full w-full">
                  <iframe
                    title="Dashboard 360"
                    src=""
                    className="w-full h-[calc(100vh-180px)] rounded-md border"
                    frameBorder="0"
                    loading="lazy"
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
