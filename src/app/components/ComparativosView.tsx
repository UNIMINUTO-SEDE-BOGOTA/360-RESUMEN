// src/components/ComparativosView.tsx
import { useState, useEffect, useMemo, useRef, Fragment } from "react";

const API_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";

const f = (v: number) => v.toLocaleString("es-CO");

function DifTd({ v }: { v: number }) {
  const c = v > 0 ? "text-blue-600" : v < 0 ? "text-red-600" : "text-gray-500";
  const sign = v > 0 ? "+" : "";
  return (
    <td className={`text-right px-2 py-0.5 ${c} font-medium`}>
      {sign}{f(v)}
    </td>
  );
}

function PctTd({ v }: { v: number }) {
  const c = v > 0 ? "text-blue-600" : v < 0 ? "text-red-600" : "text-gray-500";
  const sign = v > 0 ? "+" : "";
  return (
    <td className={`text-right px-2 py-0.5 ${c} font-medium`}>
      {sign}{v.toFixed(2)} %
    </td>
  );
}

function pct(a: number, b: number) {
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

const ORDEN_FORMACION = [
  "Licenciatura",
  "Profesional",
  "Técnico Profesional",
  "Tecnología",
  "Especialización",
  "Maestría",
];

interface CompRow {
  Año: number;
  Modalidad: string;
  "Nivel Académico": string;
  "Nivel de Formación": string;
  total: number;
}

interface ColabRow {
  modalidad?: string;
  genero?: string;
  tipo?: string;
  nivelFormacion?: string;
  dedicacion?: string;
  duracionContrato?: string;
  escalafon?: string;
  tipoContrato?: string;
  total?: number;
}

interface OfertaRow {
  nivelFormacion?: string;
  modalidad?: string;
  denominacion?: string;
  departamento?: string;
  estado?: string;
  acreditados?: string;
}

function TableHeader({ title }: { title: string }) {
  return (
    <div className="bg-slate-700 text-white text-xs font-bold text-center py-1.5 px-2 rounded-t-md">
      {title}
    </div>
  );
}

interface MultiCheckDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

function MultiCheckDropdown({ label, options, selected, onChange }: MultiCheckDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSelected = selected.length === 0 || selected.length === options.length;

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange([...options]);
  };

  const displayText = allSelected
    ? "Todas"
    : selected.length === 1
    ? selected[0].length > 20 ? selected[0].slice(0, 18) + "…" : selected[0]
    : `${selected.length} seleccionados`;

  return (
    <div className="relative" ref={ref}>
      <div className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">{label}</div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full border rounded text-xs p-1 text-left bg-white flex justify-between items-center gap-1 hover:bg-slate-50"
      >
        <span className="truncate">{displayText}</span>
        <span className="text-slate-400 text-[10px] flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full min-w-[180px] bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto">
          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer border-b text-xs font-medium text-slate-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
            Seleccionar todo
          </label>
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="rounded" />
              <span className="truncate" title={opt}>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function ComparativosView() {

  // ── STATE ──────────────────────────────────
  const [compRows, setCompRows] = useState<CompRow[]>([]);
  const [colab25, setColab25] = useState<ColabRow[]>([]);
  const [colab26, setColab26] = useState<ColabRow[]>([]);
  const [ofertaRows, setOfertaRows] = useState<OfertaRow[]>([]); // ✅ DENTRO del componente
  const [loading, setLoading] = useState(true);

  const [selModalidades, setSelModalidades] = useState<string[]>([]);
  const [selNiveles, setSelNiveles] = useState<string[]>([]);
  const [selPeriodos, setSelPeriodos] = useState<string[]>([]);

  // ── FETCH ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // 1️⃣ Estudiantes
        const resComp = await fetch(`${API_URL}/api/comparativos`);
        if (!resComp.ok) throw new Error(`comparativos: ${resComp.status}`);
        setCompRows(await resComp.json());

        // 2️⃣ Colaboradores
        try {
          const [resC25, resC26] = await Promise.all([
            fetch(`${API_URL}/api/colaboradores?periodo=2025-1`),
            fetch(`${API_URL}/api/colaboradores?periodo=2026-1`),
          ]);
          const [c25, c26] = await Promise.all([resC25.json(), resC26.json()]);
          setColab25(Array.isArray(c25) ? c25 : []);
          setColab26(Array.isArray(c26) ? c26 : []);
        } catch (e) {
          console.error("Error colaboradores:", e);
        }

        // 3️⃣ Oferta Activa
        try {
          const resOferta = await fetch(`${API_URL}/api/oferta-activa`);
          const dataOferta = await resOferta.json();
          setOfertaRows(Array.isArray(dataOferta) ? dataOferta : []);
        } catch (e) {
          console.error("Error oferta-activa:", e);
        }

      } catch (e) {
        console.error("❌ Error cargando comparativos:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── OPCIONES DE FILTRO ─────────────────────
  const modalidadOpts = useMemo(
    () => [...new Set(compRows.map((r) => r.Modalidad).filter(Boolean))].sort(),
    [compRows]
  );
  const nivelOpts = useMemo(
    () => [...new Set(compRows.map((r) => r["Nivel Académico"]).filter(Boolean))].sort(),
    [compRows]
  );
  const periodoOpts = useMemo(
    () => [...new Set(compRows.map((r) => String(r.Año)).filter(Boolean))].sort(),
    [compRows]
  );

  // ── FILTRAR ESTUDIANTES ────────────────────
  const filteredRows = useMemo(() => {
    return compRows.filter((r) => {
      if (selModalidades.length > 0 && !selModalidades.includes(r.Modalidad)) return false;
      if (selNiveles.length > 0 && !selNiveles.includes(r["Nivel Académico"])) return false;
      if (selPeriodos.length > 0 && !selPeriodos.includes(String(r.Año))) return false;
      return true;
    });
  }, [compRows, selModalidades, selNiveles, selPeriodos]);

  const rows25 = useMemo(() => filteredRows.filter((r) => r.Año === 2025), [filteredRows]);
  const rows26 = useMemo(() => filteredRows.filter((r) => r.Año === 2026), [filteredRows]);

  // ── KPIs ───────────────────────────────────
  const totalColab26 = useMemo(
    () => colab26.reduce((s, r) => s + (r.total || 0), 0),
    [colab26]
  );
  const totalEst26 = useMemo(
    () => rows26.reduce((s, r) => s + (r.total || 0), 0),
    [rows26]
  );

  // Oferta Académica: programas activos con sede en Bogotá
  
  const ofertaAcademica = useMemo(() => {
    return ofertaRows.filter((r) => {
      const dep = (r.departamento || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();

      return dep === "bogota"; // ✅ SOLO Bogotá exacto
    }).length;
  }, [ofertaRows]);


  // Programas Acreditados: mismos programas de Bogotá con acreditados = 'SI' o similar
  const programasAcreditados = useMemo(() => {
  return ofertaRows.filter((r) => {
    const dep = (r.departamento || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();

    const acred = (r.acreditados || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();

    return dep === "bogota" && acred === "acreditado"; // ✅ condición exacta
  }).length;
}, [ofertaRows]);

  // ── PROFESORES TC ──────────────────────────
  const profTC25 = useMemo(() => colab25.filter((r) => r.tipo === "Profesores"), [colab25]);
  const profTC26 = useMemo(() => colab26.filter((r) => r.tipo === "Profesores"), [colab26]);

  interface ProfRow { label: string; v25: number; v26: number }

  const profTCRows = useMemo((): ProfRow[] => {
    const map25: Record<string, number> = {};
    const map26: Record<string, number> = {};
    profTC25.forEach((r) => { const k = r.duracionContrato || "Sin información"; map25[k] = (map25[k] || 0) + (r.total || 0); });
    profTC26.forEach((r) => { const k = r.duracionContrato || "Sin información"; map26[k] = (map26[k] || 0) + (r.total || 0); });
    const keys = [...new Set([...Object.keys(map25), ...Object.keys(map26)])].sort();
    return keys.map((k) => ({ label: k, v25: map25[k] || 0, v26: map26[k] || 0 }));
  }, [profTC25, profTC26]);

  const profTCTotal25 = profTCRows.reduce((s, r) => s + r.v25, 0);
  const profTCTotal26 = profTCRows.reduce((s, r) => s + r.v26, 0);

  // ── COLABORADORES TC ───────────────────────
  const colabTC25 = useMemo(() => colab25.filter((r) => r.tipo === "Gestión Académica"), [colab25]);
  const colabTC26 = useMemo(() => colab26.filter((r) => r.tipo === "Gestión Académica"), [colab26]);

  interface ColabTCRow { label: string; v25: number; v26: number }

  const colabTCRows = useMemo((): ColabTCRow[] => {
    const map25: Record<string, number> = {};
    const map26: Record<string, number> = {};
    colabTC25.forEach((r) => { const k = r.duracionContrato || "Sin información"; map25[k] = (map25[k] || 0) + (r.total || 0); });
    colabTC26.forEach((r) => { const k = r.duracionContrato || "Sin información"; map26[k] = (map26[k] || 0) + (r.total || 0); });
    const keys = [...new Set([...Object.keys(map25), ...Object.keys(map26)])].sort();
    return keys.map((k) => ({ label: k, v25: map25[k] || 0, v26: map26[k] || 0 }));
  }, [colabTC25, colabTC26]);

  const colabTCTotal25 = colabTCRows.reduce((s, r) => s + r.v25, 0);
  const colabTCTotal26 = colabTCRows.reduce((s, r) => s + r.v26, 0);

  // ── ESTUDIANTES TOTALES S1Q1 ───────────────
  interface SubItem { label: string; v25: number; v26: number }
  interface NivelGroup { nivel: string; subniveles: SubItem[]; v25: number; v26: number }

  const estTotalesRows = useMemo((): NivelGroup[] => {
    const agg = (rows: CompRow[]) => {
      const map: Record<string, Record<string, number>> = {};
      rows.forEach((r) => {
        const nivel = r["Nivel Académico"] || "Sin información";
        const sub = (r["Nivel de Formación"] || "Sin información").trim();
        if (!map[nivel]) map[nivel] = {};
        map[nivel][sub] = (map[nivel][sub] || 0) + (r.total || 0);
      });
      return map;
    };
    const m25 = agg(rows25);
    const m26 = agg(rows26);
    return ["Pregrado", "Posgrado"].map((nivel) => {
      const subs25 = m25[nivel] || {};
      const subs26 = m26[nivel] || {};
      const subkeys = ORDEN_FORMACION.filter((k) => subs25[k] !== undefined || subs26[k] !== undefined);
      const subniveles = subkeys.map((s) => ({ label: s, v25: subs25[s] || 0, v26: subs26[s] || 0 }));
      return { nivel, subniveles, v25: subniveles.reduce((a, b) => a + b.v25, 0), v26: subniveles.reduce((a, b) => a + b.v26, 0) };
    });
  }, [rows25, rows26]);

  const estTotal25 = estTotalesRows.reduce((s, r) => s + r.v25, 0);
  const estTotal26 = estTotalesRows.reduce((s, r) => s + r.v26, 0);

  // ── ESTUDIANTES POR MODALIDAD ──────────────
  interface ModalidadGroup { modalidad: string; subniveles: SubItem[]; v25: number; v26: number }

  const estModalidadRows = useMemo((): ModalidadGroup[] => {
    const agg = (rows: CompRow[]) => {
      const map: Record<string, Record<string, number>> = {};
      rows.forEach((r) => {
        const mod = r["Modalidad"] || "Sin información";
        const sub = r["Nivel de Formación"] || "Sin información";
        if (!map[mod]) map[mod] = {};
        map[mod][sub] = (map[mod][sub] || 0) + (r.total || 0);
      });
      return map;
    };
    const m25 = agg(rows25);
    const m26 = agg(rows26);
    return ["Distancia", "Presencial"].map((mod) => {
      const subs25 = m25[mod] || {};
      const subs26 = m26[mod] || {};
      const subkeys = ORDEN_FORMACION.filter((k) => subs25[k] !== undefined || subs26[k] !== undefined);
      const subniveles = subkeys.map((s) => ({ label: s, v25: subs25[s] || 0, v26: subs26[s] || 0 }));
      return { modalidad: mod, subniveles, v25: subniveles.reduce((a, b) => a + b.v25, 0), v26: subniveles.reduce((a, b) => a + b.v26, 0) };
    });
  }, [rows25, rows26]);

  const modTotal25 = estModalidadRows.reduce((s, r) => s + r.v25, 0);
  const modTotal26 = estModalidadRows.reduce((s, r) => s + r.v26, 0);

  // ── EXPAND STATE ───────────────────────────
  const [expandedNiveles, setExpandedNiveles] = useState<Record<string, boolean>>({ "Pregrado": true, "Posgrado": true });
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({ "Distancia": true, "Presencial": true });

  const toggleNivel = (k: string) => setExpandedNiveles((p) => ({ ...p, [k]: !p[k] }));
  const toggleMod = (k: string) => setExpandedMods((p) => ({ ...p, [k]: !p[k] }));

  const clearFilters = () => {
    setSelModalidades([]);
    setSelNiveles([]);
    setSelPeriodos([]);
  };

  // ── CLASES ─────────────────────────────────
  const thClass = "px-2 py-1 text-center font-semibold text-[11px] bg-slate-50 border-b";
  const tdClass = "px-2 py-0.5 text-right text-xs";
  const tdLClass = "px-2 py-0.5 text-left text-xs";
  const trHover = "hover:bg-slate-50 transition-colors";

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto text-slate-800 text-xs">

      {/* ── HEADER ─────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={clearFilters}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-semibold transition-colors whitespace-nowrap"
        >
          Limpiar Filtros
        </button>

        <div className="flex-1 bg-slate-700 text-white text-center py-2 rounded font-bold text-sm tracking-wide">
          SEDE UNIMINUTO BOGOTÁ / COMPARATIVOS
        </div>
      </div>

      {/* ── ROW ÚNICO: 3 columnas ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_1fr] gap-3">

        {/* IZQUIERDA */}
        <div className="flex flex-col gap-3 order-2 md:order-1">

          {/* Profesores TC */}
          <div className="border rounded-md overflow-hidden bg-white">
            <TableHeader title="PROFESORES TIEMPO COMPLETO" />
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className={`${thClass} text-left`}>PROFESORES</th>
                  <th className={thClass}>2025–1</th>
                  <th className={thClass}>2026–1</th>
                  <th className={thClass}>Variación</th>
                  <th className={thClass}>%</th>
                </tr>
              </thead>
              <tbody>
                {profTCRows.map((r, i) => (
                  <tr key={`prof-${i}-${r.label}`} className={trHover}>
                    <td className={tdLClass}>{r.label}</td>
                    <td className={tdClass}>{f(r.v25)}</td>
                    <td className={tdClass}>{f(r.v26)}</td>
                    <DifTd v={r.v26 - r.v25} />
                    <PctTd v={pct(r.v25, r.v26)} />
                  </tr>
                ))}
                {profTCRows.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-3 text-xs">Sin datos — requiere endpoint /api/colaboradores</td></tr>
                )}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td className={tdLClass}>Total</td>
                  <td className={tdClass}>{f(profTCTotal25)}</td>
                  <td className={tdClass}>{f(profTCTotal26)}</td>
                  <DifTd v={profTCTotal26 - profTCTotal25} />
                  <PctTd v={pct(profTCTotal25, profTCTotal26)} />
                </tr>
              </tbody>
            </table>
            {loading && <div className="text-center text-gray-400 py-2 text-xs">Cargando…</div>}
          </div>

          {/* Estudiantes Totales */}
          <div className="border rounded-md overflow-hidden bg-white">
            <TableHeader title="ESTUDIANTES TOTALES – S1Q1" />
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className={`${thClass} text-left`}>Nivel Académico</th>
                  <th className={thClass}>2025</th>
                  <th className={thClass}>2026</th>
                  <th className={thClass}>Variación</th>
                  <th className={thClass}>%</th>
                </tr>
              </thead>
              <tbody>
                {estTotalesRows.map((g) => (
                  <Fragment key={`nivel-group-${g.nivel}`}>
                    <tr className="bg-slate-50 font-bold cursor-pointer hover:bg-slate-100" onClick={() => toggleNivel(g.nivel)}>
                      <td className={`${tdLClass} font-bold`}>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">{expandedNiveles[g.nivel] ? "▼" : "▶"}</span>
                          {g.nivel}
                        </span>
                      </td>
                      <td className={`${tdClass} font-bold`}>{f(g.v25)}</td>
                      <td className={`${tdClass} font-bold`}>{f(g.v26)}</td>
                      <DifTd v={g.v26 - g.v25} />
                      <PctTd v={pct(g.v25, g.v26)} />
                    </tr>
                    {expandedNiveles[g.nivel] && g.subniveles.map((s, i) => (
                      <tr key={`nivel-sub-${g.nivel}-${i}-${s.label}`} className={trHover}>
                        <td className="px-2 py-0.5 text-left text-xs pl-6 text-slate-600">{s.label}</td>
                        <td className={tdClass}>{f(s.v25)}</td>
                        <td className={tdClass}>{f(s.v26)}</td>
                        <DifTd v={s.v26 - s.v25} />
                        <PctTd v={pct(s.v25, s.v26)} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                  <td className={`${tdLClass} font-bold`}>Total</td>
                  <td className={`${tdClass} font-bold`}>{f(estTotal25)}</td>
                  <td className={`${tdClass} font-bold`}>{f(estTotal26)}</td>
                  <DifTd v={estTotal26 - estTotal25} />
                  <PctTd v={pct(estTotal25, estTotal26)} />
                </tr>
              </tbody>
            </table>
            {loading && <div className="text-center text-gray-400 py-2 text-xs">Cargando…</div>}
          </div>

        </div>

        {/* CENTRO: KPIs + Filtros */}
        <div className="flex flex-col gap-2 order-1 md:order-2">

          <div className="border rounded-md bg-white p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Colaboradores 2026–1</div>
            <div className="text-3xl font-bold text-slate-800">{loading ? "…" : f(totalColab26)}</div>
          </div>

          <div className="border rounded-md bg-white p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Estudiantes S1–Q1</div>
            <div className="text-3xl font-bold text-slate-800">{loading ? "…" : f(totalEst26)}</div>
          </div>

          <div className="border rounded-md bg-white p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Oferta Académica</div>
            <div className="text-3xl font-bold text-slate-800">{loading ? "…" : ofertaAcademica}</div>
          </div>

          {/* ✅ CORREGIDO: cierre del div y valor correcto */}
          <div className="border rounded-md bg-white p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Programas Acreditados</div>
            <div className="text-3xl font-bold text-slate-800">{loading ? "…" : programasAcreditados}</div>
          </div>

          {/* FILTROS */}
          <div className="border rounded-md bg-white p-2 flex flex-col gap-2">
            <MultiCheckDropdown label="Modalidad" options={modalidadOpts} selected={selModalidades} onChange={setSelModalidades} />
            <MultiCheckDropdown label="Nivel Académico" options={nivelOpts} selected={selNiveles} onChange={setSelNiveles} />
            <MultiCheckDropdown label="Periodo" options={periodoOpts} selected={selPeriodos} onChange={setSelPeriodos} />
          </div>

        </div>

        {/* DERECHA */}
        <div className="flex flex-col gap-3 order-3">

          {/* Colaboradores TC */}
          <div className="border rounded-md overflow-hidden bg-white">
            <TableHeader title="COLABORADORES TIEMPO COMPLETO" />
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className={`${thClass} text-left`}>Gestión Académica</th>
                  <th className={thClass}>2025–1</th>
                  <th className={thClass}>2026–1</th>
                  <th className={thClass}>Variación</th>
                  <th className={thClass}>%</th>
                </tr>
              </thead>
              <tbody>
                {colabTCRows.map((r, i) => (
                  <tr key={`colab-${i}-${r.label}`} className={trHover}>
                    <td className={tdLClass}>{r.label}</td>
                    <td className={tdClass}>{f(r.v25)}</td>
                    <td className={tdClass}>{f(r.v26)}</td>
                    <DifTd v={r.v26 - r.v25} />
                    <PctTd v={pct(r.v25, r.v26)} />
                  </tr>
                ))}
                {colabTCRows.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-3 text-xs">Sin datos — requiere endpoint /api/colaboradores</td></tr>
                )}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td className={tdLClass}>Total</td>
                  <td className={tdClass}>{f(colabTCTotal25)}</td>
                  <td className={tdClass}>{f(colabTCTotal26)}</td>
                  <DifTd v={colabTCTotal26 - colabTCTotal25} />
                  <PctTd v={pct(colabTCTotal25, colabTCTotal26)} />
                </tr>
              </tbody>
            </table>
            {loading && <div className="text-center text-gray-400 py-2 text-xs">Cargando…</div>}
          </div>

          {/* Estudiantes Modalidad */}
          <div className="border rounded-md overflow-hidden bg-white">
            <TableHeader title="ESTUDIANTES MODALIDAD – S1Q1" />
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className={`${thClass} text-left`}>Modalidad</th>
                  <th className={thClass}>2025</th>
                  <th className={thClass}>2026</th>
                  <th className={thClass}>Variación</th>
                  <th className={thClass}>%</th>
                </tr>
              </thead>
              <tbody>
                {estModalidadRows.map((g) => (
                  <Fragment key={`mod-group-${g.modalidad}`}>
                    <tr className="bg-slate-50 font-bold cursor-pointer hover:bg-slate-100" onClick={() => toggleMod(g.modalidad)}>
                      <td className={`${tdLClass} font-bold`}>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">{expandedMods[g.modalidad] ? "▼" : "▶"}</span>
                          {g.modalidad}
                        </span>
                      </td>
                      <td className={`${tdClass} font-bold`}>{f(g.v25)}</td>
                      <td className={`${tdClass} font-bold`}>{f(g.v26)}</td>
                      <DifTd v={g.v26 - g.v25} />
                      <PctTd v={pct(g.v25, g.v26)} />
                    </tr>
                    {expandedMods[g.modalidad] && g.subniveles.map((s, i) => (
                      <tr key={`mod-sub-${g.modalidad}-${i}-${s.label}`} className={trHover}>
                        <td className="px-2 py-0.5 text-left text-xs pl-6 text-slate-600">{s.label}</td>
                        <td className={tdClass}>{f(s.v25)}</td>
                        <td className={tdClass}>{f(s.v26)}</td>
                        <DifTd v={s.v26 - s.v25} />
                        <PctTd v={pct(s.v25, s.v26)} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                  <td className={`${tdLClass} font-bold`}>Total</td>
                  <td className={`${tdClass} font-bold`}>{f(modTotal25)}</td>
                  <td className={`${tdClass} font-bold`}>{f(modTotal26)}</td>
                  <DifTd v={modTotal26 - modTotal25} />
                  <PctTd v={pct(modTotal25, modTotal26)} />
                </tr>
              </tbody>
            </table>
            {loading && <div className="text-center text-gray-400 py-2 text-xs">Cargando…</div>}
          </div>

        </div>
      </div>
    </div>
  );
}