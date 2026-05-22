// src/components/ParetoProyectado.tsx
import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, ReferenceLine, Legend
} from "recharts";
import { FiltersMulti } from "./FiltersMulti";


interface Props {
  fechaCorte: string;
  base: {
    years: string[];
    modalidades: string[];
    niveles: string[];
    periodos: string[];
    centros: string[];
    periodicidades: string[];
    nivelesFormacion: string[];
    facultades: string[];
    sedes: string[];
  };
  selNiveles: string[];
  setSelNiveles: (v: string[]) => void;

  selSedes: string[];                       // ✅
  setSelSedes: (v: string[]) => void;

  selFacultades: string[];                  // ✅
  setSelFacultades: (v: string[]) => void;

  listaProgramas: { label: string; value: string }[];
  pareto80: any[];
  pareto20: any[];
  dataChart: any[];
  // filtros
  selYears: string[]; setSelYears: (v: string[]) => void;
  selModalidades: string[]; setSelModalidades: (v: string[]) => void;
  selNivelFormacion: string[]; setSelNivelFormacion: (v: string[]) => void;
  selPeriodos: string[]; setSelPeriodos: (v: string[]) => void;
  selCentros: string[]; setSelCentros: (v: string[]) => void;
  selProgramas: string[]; setSelProgramas: (v: string[]) => void;

    selPeriodicidades?: string[];
    setSelPeriodicidades?: (v: string[]) => void;


    selNivelesFormacion?: string[];
    setSelNivelesFormacion?: (v: string[]) => void;

    // flags para ocultar filtros
    showYears?: boolean;
    showProgramas?: boolean;
  clearAll: () => void;
  onVolver: () => void;
  onIrEjecutado: () => void;
}

export function ParetoProyectado({
  fechaCorte, base, listaProgramas,
  pareto80, pareto20, dataChart,

  selYears, setSelYears,
  selModalidades, setSelModalidades,
  selNivelFormacion, setSelNivelFormacion,
  selPeriodos, setSelPeriodos,
  selCentros, setSelCentros,
  selNiveles, setSelNiveles,
  selSedes, setSelSedes,
  selFacultades, setSelFacultades,

  selPeriodicidades, setSelPeriodicidades,
  selNivelesFormacion, setSelNivelesFormacion,

  clearAll, onVolver, onIrEjecutado
}: Props)
 {

  const [highlightBar, setHighlightBar] = useState(false);
  const [highlightLine, setHighlightLine] = useState(false);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
        <button
          onClick={onIrEjecutado}
          className="px-4 py-2 text-sm font-medium rounded-md shadow bg-yellow-400 text-black hover:bg-yellow-500 transition whitespace-nowrap"
        >
          Pareto ejecutado
        </button>

        <div className="flex-1 text-center">

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
  SEDE UNIMINUTO BOGOTÁ / PARETO PROYECTADO
</h2>

          <div className="flex justify-end">
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
<FiltersMulti
  years={[]}
  showYears={false}
  showProgramas={false}

  centros={base.centros.map(c => ({ label: c, value: c }))}
  modalidades={base.modalidades.map(m => ({ label: m, value: m }))}
  niveles={base.niveles.map(n => ({ label: n, value: n }))}
  selNiveles={selNiveles} 
  setSelNiveles={setSelNiveles}
  periodos={base.periodos.map(p => ({ label: p, value: p }))}
  periodicidades={base.periodicidades.map(p => ({ label: p, value: p }))}
  nivelesFormacion={base.nivelesFormacion.map(n => ({ label: n, value: n }))}
  selNivelesFormacion={selNivelFormacion}
  setSelNivelesFormacion={setSelNivelFormacion}
  sedes={base.sedes.map(s => ({ label: s, value: s }))}
  selSedes={selSedes}
  setSelSedes={setSelSedes}
  facultades={base.facultades.map(f => ({ label: f, value: f }))}
  selFacultades={selFacultades}
  setSelFacultades={setSelFacultades}
  selCentros={selCentros} setSelCentros={setSelCentros}
  selModalidades={selModalidades} setSelModalidades={setSelModalidades}
  selPeriodos={selPeriodos} setSelPeriodos={setSelPeriodos}
  selPeriodicidades={selPeriodicidades} setSelPeriodicidades={setSelPeriodicidades}
  clearAll={clearAll}
/>
      </div>

      {/* CONTENIDO */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 flex-1 min-h-0">

        {/* COLUMNA IZQUIERDA */}
        <div className="flex flex-col gap-3">

          {/* TABLA 80% */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-600 text-white text-xs px-3 py-2 font-medium">
              Programas que contienen el 80% de los estudiantes nuevos
            </div>
            <div className="overflow-y-auto max-h-52">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
                    <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa académico</th>
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
            <div className="bg-slate-600 text-white text-xs px-3 py-2 font-medium">
              Programas que contienen el 20% de los estudiantes nuevos
            </div>
            <div className="overflow-y-auto max-h-52">
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
          <div className="bg-slate-600 text-white text-xs px-3 py-2 font-medium">
            Pareto de programas en relación a estudiantes nuevos
          </div>
          <div className="p-2 h-[480px]">
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

                <Bar yAxisId="left" dataKey="valor" name="valor">
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
                  name="porcentaje"
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
  );
}