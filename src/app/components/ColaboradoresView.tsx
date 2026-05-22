import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList
} from "recharts";

const API_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
interface ColaboradorRow {
  modalidad?: string;
  genero?: string;
  tipo?: string;
  nivelFormacion?: string;
  dedicacion?: string;
  escalafon?: string;
  tipoContrato?: string;
  total?: number;
}


// ─────────────────────────────────────────────
// COLORES
// ─────────────────────────────────────────────
const DEDICACION_COLORS: Record<string, string> = {
  "1.Presencial": "#7bb8f4",
  "2.Distancia": "#f4a97a",
  "Sin información": "#9ca3af",
};

const ESCALAFON_COLORS = [
  "#f4e97a", "#f4c87a", "#7bb8f4",
  "#f4a97a", "#b4d4f4", "#d4b4f4", "#f47a7a"
];

const CONTRATO_COLORS = ["#f4a97a", "#7bc8d4", "#c4a3d4", "#f4c87a"];

// ─────────────────────────────────────────────
// NORMALIZADORES
// ─────────────────────────────────────────────
function normalizeModalidad(v?: string) {
  if (!v) return "Sin información";
  const x = v.toLowerCase();
  if (x.includes("presencial")) return "1.Presencial";
  if (x.includes("distancia") || x.includes("virtual")) return "2.Distancia";
  return "Sin información";
}

function normalizeDedicacion(v?: string) {
  if (!v) return "Sin información";
  if (v.includes("Completo")) return "1.Tiempo Completo";
  if (v.includes("Medio")) return "2.Medio Tiempo";
  if (v.includes("Parcial")) return "3.Tiempo Parcial";
  return "Sin información";
}

const ESCALAFON_ORDER = [
  "Instructor 2",
  "Asistente 2",
  "Asistente 1",
  "Asociado 1",
  "Asociado 2",
  "Instructor 1",
  "Titular",
];

function normalizeEscalafon(v?: string) {
  if (!v) return null;
  for (const e of ESCALAFON_ORDER) {
    if (v.includes(e)) return e;
  }
  return null; // 👈 NO forzar “Sin clasificar”
}

// ─────────────────────────────────────────────
// CHECKBOX GROUP
// ─────────────────────────────────────────────
function CheckGroup({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(
      selected.includes(v)
        ? selected.filter(x => x !== v)
        : [...selected, v]
    );

  return (
    
<div className="border border-slate-300 rounded-lg bg-white mb-3 overflow-hidden shadow-sm">

  {/* TÍTULO */}
  <div className="bg-slate-100 text-[11px] font-bold text-slate-700 px-2 py-1 uppercase tracking-wide text-center">
    {label}
  </div>

  {/* OPCIONES */}
  <div className="p-2 flex flex-col gap-1">
    {options.map(o => (
      <label
        key={o}
        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 px-1 py-1 rounded"
      >
        <input
          type="checkbox"
          checked={selected.includes(o)}
          onChange={() => toggle(o)}
          className="accent-blue-500"
        />
        {o}
      </label>
    ))}
  </div>

</div>

  );
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ColaboradoresView() {

  const [rows, setRows] = useState<ColaboradorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selModalidad, setSelModalidad] = useState<string[]>([]);
  const [selGenero, setSelGenero] = useState<string[]>([]);
  const [selTipo, setSelTipo] = useState<string[]>(["Profesores"]);

  // Fetch
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/colaboradores?periodo=2026-1`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Dataset filtrado
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selModalidad.length && !selModalidad.includes(normalizeModalidad(r.modalidad))) return false;
      if (selGenero.length && !selGenero.includes(r.genero || "")) return false;
      if (selTipo.length && !selTipo.includes(r.tipo || "")) return false;
      return true;
    });
  }, [rows, selModalidad, selGenero, selTipo]);

  // KPI
  const totalColaboradores = useMemo(
    () => filteredRows.reduce((s, r) => s + (r.total || 0), 0),
    [filteredRows]
  );

  // NIVEL DE FORMACIÓN
  const nivelTotals = useMemo(() => {
    const map: any = {};
    filteredRows.forEach(r => {
      const nivel = r.nivelFormacion || "Sin información";
      const ded = normalizeDedicacion(r.dedicacion);
      if (!map[nivel]) {
        map[nivel] = {
          nivel,
          "1.Tiempo Completo": 0,
          "2.Medio Tiempo": 0,
          "3.Tiempo Parcial": 0
        };
      }
      map[nivel][ded] += r.total || 0;
    });
    return Object.values(map);
  }, [filteredRows]);

  // DEDICACIÓN (STACKED)
  const dedicacionData = useMemo(() => {
    const map: any = {};
    filteredRows.forEach(r => {
      const ded = normalizeDedicacion(r.dedicacion);
      const mod = normalizeModalidad(r.modalidad);
      if (!map[ded]) {
        map[ded] = {
          name: ded,
          "1.Presencial": 0,
          "2.Distancia": 0,
          "Sin información": 0
        };
      }
      map[ded][mod] += r.total || 0;
    });
    return Object.values(map);
  }, [filteredRows]);

  // ESCALAFÓN (CORREGIDO)
  const escalafonData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach(r => {
      const esc = normalizeEscalafon(r.escalafon);
      if (!esc) return; // 👈 ignorar “sin clasificar”
      map[esc] = (map[esc] || 0) + (r.total || 0);
    });
    return ESCALAFON_ORDER
      .filter(e => map[e])
      .map(e => ({ name: e, valor: map[e] }));
  }, [filteredRows]);

  // CONTRATO
  const contratoData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach(r => {
      const c = r.tipoContrato || "Sin información";
      map[c] = (map[c] || 0) + (r.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      pct: totalColaboradores
        ? ((value * 100) / totalColaboradores).toFixed(2) + "%"
        : "0%"
    }));
  }, [filteredRows, totalColaboradores]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row h-full gap-3">

      {/* SIDEBAR */}
      <aside className="w-full md:w-56 bg-white border rounded-lg p-3 md:p-4 shrink-0">
        <CheckGroup
          label="Modalidad"
          options={["1.Presencial", "2.Distancia", "Sin información"]}
          selected={selModalidad}
          onChange={setSelModalidad}
        />
        <CheckGroup
          label="Género"
          options={["Femenino", "Masculino"]}
          selected={selGenero}
          onChange={setSelGenero}
        />
        <CheckGroup
          label="Tipo"
          options={["Profesores","Gestión Académica","Gestión Administrativa","Proyectos"]}
          selected={selTipo}
          onChange={setSelTipo}
        />
      </aside>

      {/* CONTENIDO */}
      <div className="flex-1 flex flex-col gap-3">

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_180px] gap-3">          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
            <div className="text-[10px] text-blue-500 font-semibold uppercase">
              Colaboradores Totales
            </div>
            <div className="text-3xl font-bold text-blue-700">
              {loading ? "…" : totalColaboradores.toLocaleString("es-CO")}
            </div>
          </div>

          <div className="flex-1 bg-slate-700 text-white text-center rounded-lg py-3">
            <div className="text-sm font-bold">
              SEDE UNIMINUTO BOGOTÁ – COLABORADORES
            </div>
            <div className="text-xs text-slate-300">2026-1</div>
          </div>
        </div>

        {/* NIVEL + DEDICACIÓN */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3">
          {/* NIVEL */}
          <div className="bg-white border rounded-xl overflow-x-auto">
            <div className="bg-slate-700 text-white text-[11px] font-semibold text-center py-1.5">
              Nivel de Formación
            </div>
            <div className="min-w-[420px]">
            <table className="text-xs w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1 text-left">Nivel</th>
                  <th className="px-2 py-1 text-center">Completo</th>
                  <th className="px-2 py-1 text-center">Medio</th>
                  <th className="px-2 py-1 text-center">Parcial</th>
                </tr>
              </thead>
              <tbody>
                {nivelTotals.map((r: any, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{r.nivel}</td>
                    <td className="px-2 py-1 text-center">{r["1.Tiempo Completo"] || ""}</td>
                    <td className="px-2 py-1 text-center">{r["2.Medio Tiempo"] || ""}</td>
                    <td className="px-2 py-1 text-center">{r["3.Tiempo Parcial"] || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {/* DEDICACIÓN */}
<div className="bg-white border rounded-xl overflow-hidden">
  <div className="bg-slate-700 text-white text-[11px] font-semibold text-center py-1.5">
    Colaboradores por dedicación
  </div>
  <div className="p-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dedicacionData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                {["1.Presencial","2.Distancia","Sin información"].map(k => (
                  <Bar key={k} dataKey={k} stackId="a" fill={DEDICACION_COLORS[k]}>
                    <LabelList dataKey={k} position="center" />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>



        {/* ESCALAFÓN + CONTRATO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">


          {/* ESCALAFÓN */}
          <div className="bg-white border rounded-xl overflow-hidden">
  <div className="bg-slate-700 text-white text-[11px] font-semibold text-center py-1.5">
    Escalafón docente
  </div>
  <div className="p-2 h-56">

            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                  data={escalafonData}
                  margin={{ top: 35, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  
                  
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    height={60}
                    interval={0}   // 👈 CLAVE: muestra todos
                  />


                  <YAxis />

                  <Tooltip />

                  <Bar dataKey="valor">
                    {escalafonData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={ESCALAFON_COLORS[i % ESCALAFON_COLORS.length]}
                      />
                    ))}

                    {/* 👇 separación del número */}
                    <LabelList
                      dataKey="valor"
                      position="top"
                      offset={10}
                    />

                  </Bar>
                </BarChart>

            </ResponsiveContainer>
          </div>
          </div>

          {/* CONTRATO */}
          <div className="bg-white border rounded-xl overflow-hidden">
  <div className="bg-slate-700 text-white text-[11px] font-semibold text-center py-1.5">
    Tipo de contrato
  </div>
  <div className="p-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contratoData}
                  dataKey="value"
                  outerRadius={75}
                  label={({ pct }) => pct}
                >
                  {contratoData.map((_, i) => (
                    <Cell key={i} fill={CONTRATO_COLORS[i % CONTRATO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          </div>

        </div>
      </div>
    </div>
  );
}