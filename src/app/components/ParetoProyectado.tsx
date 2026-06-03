// src/components/ParetoProyectado.tsx
import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, ReferenceLine, Legend
} from "recharts";
import { FiltersMulti } from "./FiltersMulti";
import { ParetoTablas } from "./ParetoTablas";
import { GraficaPareto } from "./GraficaPareto";


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
  pareto80: { pregrado: ParetoItem[]; posgrado: ParetoItem[] };
  pareto20: { pregrado: ParetoItem[]; posgrado: ParetoItem[] };
  dataChartPregrado: any[];
  dataChartPosgrado: any[];
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
  pareto80, pareto20,
  dataChartPregrado,
  dataChartPosgrado,
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
  years={base.years.map(y => ({ label: y, value: y }))}
  showYears={true}
  showProgramas={false}
  selYears={selYears}
  setSelYears={setSelYears}
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

// DESPUÉS
<div className="flex flex-col gap-4">

  {/* PREGRADO */}
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">
    <ParetoTablas
      pareto80={{ pregrado: pareto80.pregrado, posgrado: [] }}
      pareto20={{ pregrado: pareto20.pregrado, posgrado: [] }}
    />
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <GraficaPareto
        titulo="Pregrado — Pareto de programas en relación a estudiantes nuevos"
        colorHeader="bg-slate-700"
        data={dataChartPregrado}
      />
    </div>
  </div>

  {/* POSGRADO */}
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3">
    <ParetoTablas
      pareto80={{ pregrado: [], posgrado: pareto80.posgrado }}
      pareto20={{ pregrado: [], posgrado: pareto20.posgrado }}
    />
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <GraficaPareto
        titulo="Posgrado — Pareto de programas en relación a estudiantes nuevos"
        colorHeader="bg-purple-700"
        data={dataChartPosgrado}
      />
    </div>
  </div>

</div>
</div>
  );
}
