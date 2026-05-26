// src/components/OfertaView.tsx
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DropdownMulti } from "./FiltersMulti";

const API_URL =
  (import.meta as any).env?.VITE_API_URL ||
  "https://three60-resumen-backend.onrender.com";

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

const COLORES: Record<string, string> = {
  "Universitario":                 "#90c8f0",
  "Especialización Universitaria": "#f4c9a0",
  "Maestría":                      "#c9b8e8",
  "Tecnológico":                   "#f4c0d8",
  "Técnico profesional":           "#e8e8a0",
};
const COLOR_DEFAULT = "#cbd5e1";

// CheckGroup — solo se usa en PC (flotante sobre la gráfica)
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
  const n = nivel.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  if (n === "especializacion universitaria") return "Especialización Universitaria";
  if (n === "maestria") return "Maestría";
  if (n === "universitario") return "Universitario";
  if (n === "tecnologico") return "Tecnológico";
  if (n === "tecnico profesional") return "Técnico profesional";
  return nivel;
}

interface Props { fechaCorte?: string; }

export function OfertaView({ fechaCorte = "20 de febrero de 2026" }: Props) {
  const [data, setData]       = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selPer, setSelPer]   = useState<string[]>([]);
  const [selMod, setSelMod]   = useState<string[]>([]);
  const [selNiv, setSelNiv]   = useState<string[]>([]);
  const [exp, setExp]         = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/oferta-activa`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((rows: Programa[]) => {
        const normalizados = rows.map(r => ({ 
          ...r, 
          nivelFormacion: normalizarNivel(r.nivelFormacion) 
        }));
      
        setData(normalizados);
      
        const niveles = [...new Set(normalizados.map(r => r.nivelFormacion))];
        setExp(Object.fromEntries(niveles.map(n => [n, true])));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const opcionesPer = useMemo(() => [...new Set(data.map(r => r.periodicidad).filter(Boolean))].sort(), [data]);
  const opcionesMod = useMemo(() => [...new Set(data.map(r => r.modalidad).filter(Boolean))].sort(), [data]);
  const opcionesNiv = useMemo(() => [...new Set(data.map(r => r.nivelFormacion).filter(Boolean))].sort(), [data]);

  const filtrado = useMemo(() => data.filter(r => {
    if (selPer.length && !selPer.includes(r.periodicidad)) return false;
    if (selMod.length && !selMod.includes(r.modalidad))    return false;
    if (selNiv.length && !selNiv.includes(r.nivelFormacion)) return false;
    return true;
  }), [data, selPer, selMod, selNiv]);

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

  const barras = useMemo(() =>
    tabla.map(g => ({ nombre: g.nivel, valor: g.total, color: COLORES[g.nivel] ?? COLOR_DEFAULT })),
    [tabla]
  );

  const limpiar = () => { setSelPer([]); setSelMod([]); setSelNiv([]); };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 overflow-y-auto">

      {/* HEADER */}
      <div className="bg-[#2d3748] text-white text-center rounded py-2.5">
        <span className="text-[13px] font-bold tracking-wide">
          SEDE UNIMINUTO BOGOTÁ / OFERTA ACADÉMICA
        </span>
      </div>

      {/* FILTROS — solo móvil */}
      <div className="flex md:hidden bg-white border-b px-2 py-1">
        <div className="flex flex-wrap gap-2 items-end w-full [&>*]:flex-1 [&>*]:min-w-[130px]">
          {opcionesPer.length > 0 && (
            <DropdownMulti
              label="Periodicidad"
              options={opcionesPer.map(o => ({ label: o, value: o }))}
              selected={selPer}
              onChange={setSelPer}
            />
          )}
          {opcionesMod.length > 0 && (
            <DropdownMulti
              label="Modalidad"
              options={opcionesMod.map(o => ({ label: o, value: o }))}
              selected={selMod}
              onChange={setSelMod}
            />
          )}
          {opcionesNiv.length > 0 && (
            <DropdownMulti
              label="Nivel Académico"
              options={opcionesNiv.map(o => ({ label: o, value: o }))}
              selected={selNiv}
              onChange={setSelNiv}
            />
          )}
          <button
            onClick={limpiar}
            className="h-[30px] px-2 border rounded-md text-[11px] text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
          >
            🗑 Limpiar
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded px-3 py-2 text-[12px]">
          ⚠️ No se pudo cargar la oferta: {error}
        </div>
      )}

      {/* CUERPO */}
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start flex-1">

          {/* TORTA — con CheckGroup flotante en PC */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white">
            <div className="bg-[#4a5568] text-white text-center text-[11px] font-bold py-1.5">
              Programas por Nivel Académico
            </div>
            <div className="relative" style={{ minHeight: 380 }}>

              {/* CheckGroup flotante — solo PC */}
              <div className="hidden md:flex absolute top-3 left-3 z-10 flex-col gap-2 w-[148px]">
                {opcionesPer.length > 0 && (
                  <CheckGroup label="Periodicidad" options={opcionesPer} selected={selPer} onChange={setSelPer} />
                )}
                {opcionesMod.length > 0 && (
                  <CheckGroup label="Modalidad" options={opcionesMod} selected={selMod} onChange={setSelMod} />
                )}
                {opcionesNiv.length > 0 && (
                  <CheckGroup label="Nivel Académico" options={opcionesNiv} selected={selNiv} onChange={setSelNiv} />
                )}
                <button
                  onClick={limpiar}
                  className="text-[11px] text-red-500 hover:text-red-700 text-left px-1"
                >
                  🗑 Limpiar
                </button>
              </div>

              {/* GRÁFICA — torta en ambas vistas */}
              <div className="md:pl-[168px] pl-2 pr-4 pt-4 pb-2" style={{ height: 380 }}>
                {barras.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-[12px]">
                    Sin resultados para los filtros seleccionados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={barras}
                        dataKey="valor"
                        nameKey="nombre"
                        outerRadius="70%"
                        label={({ nombre, valor, percent }) =>
                          `${valor} (${(percent * 100).toFixed(1)}%)`
                        }
                        labelLine={true}
                      >
                        {barras.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, name: any) => [v, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* TABLA */}
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
