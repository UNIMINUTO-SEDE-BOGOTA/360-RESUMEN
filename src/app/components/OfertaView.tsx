// src/components/OfertaView.tsx
import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

const API_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Programa {
  facultad: string;
  registroUnico: string;
  resolucion: string;
  codigoSnies: string;
  codigoBanner: string;
  denominacion: string;
  nivelFormacion: string;
  modalidad: string;
  periodicidad: string;
  duracion: string;
  creditos: number;
  cupos: number;
  rectoria: string;
  departamento: string;
  municipio: string;
  cobertura: string;
  tipo: string;
  estado: string;
  fechaResolucion: string;
  fechaVencimiento: string;
  resolucionAcreditacion: string;
  fechaAcreditacion: string;
  vigencia: string;
  acreditados: string;
}

// ─── Paleta por nivel ─────────────────────────────────────────────────────────
const COLORES: Record<string, string> = {
  "Universitario":                  "#90c8f0",
  "Especialización Universitaria":  "#f4c9a0",
  "Maestría":                       "#c9b8e8",
  "Tecnológico":                    "#f4c0d8",
  "Técnico profesional":            "#e8e8a0",
};
const COLOR_DEFAULT = "#cbd5e1";

// ─── CheckGroup ──────────────────────────────────────────────────────────────
function CheckGroup({
  label, options, selected, onChange,
}: {
  label: string; options: string[];
  selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div className="border border-slate-300 rounded overflow-hidden bg-white">
      <div className="bg-[#4a5568] text-white text-center text-[10px] font-bold py-1 uppercase tracking-wide">
        {label}
      </div>
      <div className="px-2 py-1 flex flex-col gap-0.5">
        {options.map(o => (
          <label key={o}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
            <input type="checkbox" checked={selected.includes(o)}
              onChange={() => toggle(o)} className="accent-blue-500" />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
      <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-[12px]">Cargando oferta académica…</span>
    </div>
  );
}

function normalizarNivel(nivel?: string) {
  if (!nivel) return "Sin información";

  const n = nivel
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

  if (n === "especializacion universitaria") return "Especialización Universitaria";
  if (n === "maestria") return "Maestría";
  if (n === "universitario") return "Universitario";
  if (n === "tecnologico") return "Tecnológico";
  if (n === "tecnico profesional") return "Técnico profesional";

  return nivel; // fallback si no coincide
}

// ─── Componente principal ────────────────────────────────────────────────────
interface Props {
  fechaCorte?: string;
}

export function OfertaView({ fechaCorte = "20 de febrero de 2026" }: Props) {
  // ── Estado global ──────────────────────────────────────────────────────────
  const [data, setData]       = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Filtros UI ─────────────────────────────────────────────────────────────
  const [selPer, setSelPer] = useState<string[]>([]);
  const [selMod, setSelMod] = useState<string[]>([]);
  const [selNiv, setSelNiv] = useState<string[]>([]);

  // ── Expandir filas tabla ───────────────────────────────────────────────────
  const [exp, setExp] = useState<Record<string, boolean>>({});

  // ── Fetch inicial (solo activos de Bogotá) ─────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/oferta-activa`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows: Programa[]) => {
        // Filtrar solo Bogotá por departamento (redundante con servidor, pero explícito)
        const bogota = rows.filter(r =>
          (r.departamento || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .trim() === "bogota"
        );
        const normalizados = bogota.map((r) => ({
          ...r,
          nivelFormacion: normalizarNivel(r.nivelFormacion),
        }));

        setData(normalizados);
        // Expandir todos los niveles por defecto
        const niveles = [...new Set(bogota.map(r => r.nivelFormacion))];
        setExp(Object.fromEntries(niveles.map(n => [n, true])));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Opciones dinámicas para filtros ───────────────────────────────────────
  const opcionesPer = useMemo(
    () => [...new Set(data.map(r => r.periodicidad).filter(Boolean))].sort(),
    [data],
  );
  const opcionesMod = useMemo(
    () => [...new Set(data.map(r => r.modalidad).filter(Boolean))].sort(),
    [data],
  );
  const opcionesNiv = useMemo(
    () => [...new Set(data.map(r => r.nivelFormacion).filter(Boolean))].sort(),
    [data],
  );

  // ── Datos filtrados ────────────────────────────────────────────────────────
  const filtrado = useMemo(() => {
    return data.filter(r => {
      if (selPer.length && !selPer.includes(r.periodicidad)) return false;
      if (selMod.length && !selMod.includes(r.modalidad))    return false;
      if (selNiv.length && !selNiv.includes(r.nivelFormacion)) return false;
      return true;
    });
  }, [data, selPer, selMod, selNiv]);

  // ── Tabla: agrupado por nivel → modalidad ─────────────────────────────────
  const tabla = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of filtrado) {
      if (!map[r.nivelFormacion]) map[r.nivelFormacion] = {};
      map[r.nivelFormacion][r.modalidad] = (map[r.nivelFormacion][r.modalidad] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([nivel, mods]) => ({
        nivel,
        total: Object.values(mods).reduce((a, b) => a + b, 0),
        hijos: Object.entries(mods)
          .map(([modalidad, count]) => ({ modalidad, count }))
          .sort((a, b) => a.modalidad.localeCompare(b.modalidad)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtrado]);

  const totalGeneral = tabla.reduce((s, g) => s + g.total, 0);

  // ── Datos gráfica ──────────────────────────────────────────────────────────
  const barras = useMemo(
    () =>
      tabla.map(g => ({
        nombre: g.nivel,
        valor: g.total,
        color: COLORES[g.nivel] ?? COLOR_DEFAULT,
      })),
    [tabla],
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2 h-full min-h-0 overflow-y-auto">

      {/* ══ HEADER ══ */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-[#2d3748] text-white text-center rounded py-2.5">
          <span className="text-[13px] font-bold tracking-wide">
            SEDE UNIMINUTO BOGOTÁ / OFERTA ACADÉMICA
          </span>
        </div>
      </div>

      {/* ══ ERROR ══ */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded px-3 py-2 text-[12px]">
          ⚠️ No se pudo cargar la oferta: {error}
        </div>
      )}

      {/* ══ CUERPO ══ */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-start flex-1">

          {/* ── GRÁFICA + FILTROS FLOTANTES ── */}
          <div className="relative border border-slate-300 rounded overflow-hidden bg-white">
            <div className="bg-[#4a5568] text-white text-center text-[11px] font-bold py-1.5">
              Programas por Nivel Académico y Categorización
            </div>

            <div className="relative" style={{ minHeight: 380 }}>

              {/* FILTROS flotantes */}
              <div className="hidden md:flex absolute top-3 left-3 z-10 flex-col gap-2 w-[148px]">
                {opcionesPer.length > 0 && (
                  <CheckGroup
                    label="Periodicidad"
                    options={opcionesPer}
                    selected={selPer}
                    onChange={setSelPer}
                  />
                )}
                {opcionesMod.length > 0 && (
                  <CheckGroup
                    label="Modalidad"
                    options={opcionesMod}
                    selected={selMod}
                    onChange={setSelMod}
                  />
                )}
                {opcionesNiv.length > 0 && (
                  <CheckGroup
                    label="Nivel Académico"
                    options={opcionesNiv}
                    selected={selNiv}
                    onChange={setSelNiv}
                  />
                )}
              </div>
{/* FILTROS EN MÓVIL */}
<div className="flex md:hidden flex-col gap-2 p-3">
  {opcionesPer.length > 0 && (
    <CheckGroup
      label="Periodicidad"
      options={opcionesPer}
      selected={selPer}
      onChange={setSelPer}
    />
  )}
  {opcionesMod.length > 0 && (
    <CheckGroup
      label="Modalidad"
      options={opcionesMod}
      selected={selMod}
      onChange={setSelMod}
    />
  )}
  {opcionesNiv.length > 0 && (
    <CheckGroup
      label="Nivel Académico"
      options={opcionesNiv}
      selected={selNiv}
      onChange={setSelNiv}
    />
  )}
</div>
              {/* GRÁFICA */}
              <div className="md:pl-[168px] pl-2 pr-4 pt-4 pb-2" style={{ height: 380 }}>
                {barras.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-[12px]">
                    Sin resultados para los filtros seleccionados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barras}
                      margin={{ top: 40, right: 10, left: 10, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis
                        dataKey="nombre"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={90}
                      />
                      <YAxis hide domain={[0, 'dataMax + 8']} />
                      <Tooltip formatter={(v: any) => [v, "Programas"]} />
                      <Bar dataKey="valor" radius={[2, 2, 0, 0]} maxBarSize={80}>
                        {barras.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                        <LabelList
                          dataKey="valor"
                          position="top"
                          style={{ fontSize: 11, fontWeight: "bold", fill: "#374151" }}
                          offset={6}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ── TABLA NIVEL / MODALIDAD ── */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white">
            <div className="bg-[#4a5568] text-white text-center text-[11px] font-bold py-1.5">
              Programas por Nivel Académico y Modalidad
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#dce3ea]">
                  <th className="px-2 py-1 text-left font-bold text-slate-700 border-b border-slate-400">Nivel</th>
                  <th className="px-2 py-1 text-right font-bold text-slate-700 border-b border-slate-400">SNIES</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map((g) => (
                  <>
                    <tr
                      key={`g-${g.nivel}`}
                      className="bg-[#eaeff4] border-t border-slate-200 cursor-pointer hover:bg-[#d8e1ea]"
                      onClick={() => setExp(p => ({ ...p, [g.nivel]: !p[g.nivel] }))}
                    >
                      <td className="px-2 py-[4px] font-bold text-slate-700">
                        <span className="text-[9px] mr-1 text-slate-400 select-none">
                          {exp[g.nivel] ? "▼" : "▶"}
                        </span>
                        {g.nivel}
                      </td>
                      <td className="px-2 py-[4px] text-right font-bold text-slate-700 tabular-nums">
                        {g.total}
                      </td>
                    </tr>
                    {exp[g.nivel] && g.hijos.map((h, hi) => (
                      <tr key={`h-${g.nivel}-${h.modalidad}`}
                        className={hi % 2 === 0 ? "bg-white" : "bg-[#f2f5f8]"}>
                        <td className="pl-6 pr-2 py-[3px] text-slate-600">{h.modalidad}</td>
                        <td className="px-2 py-[3px] text-right text-slate-600 tabular-nums">{h.count}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#dce3ea] border-t-2 border-slate-400 font-bold">
                  <td className="px-2 py-1 text-slate-700">Total</td>
                  <td className="px-2 py-1 text-right text-slate-700 tabular-nums">{totalGeneral}</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}

export default OfertaView;