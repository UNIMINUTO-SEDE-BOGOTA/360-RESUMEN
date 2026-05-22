// src/components/FiltersMulti.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronDown, Check, Search, ChevronUp, Trash2 } from "lucide-react";

export type Opt = { label: string; value: string };


export interface FiltersMultiProps {
  years: Opt[];
  modalidades: Opt[];
  niveles: Opt[];
  periodos: Opt[];
  centros: Opt[];

  periodicidades?: Opt[];
  selPeriodicidades?: string[];
  setSelPeriodicidades?: (v: string[]) => void;

  nivelesFormacion?: Opt[];
  selNivelesFormacion?: string[];
  setSelNivelesFormacion?: (v: string[]) => void;

  selYears?: string[];
  setSelYears?: (v: string[]) => void;


  sedes?: Opt[];
  selSedes?: string[];
  setSelSedes?: (v: string[]) => void;

  selModalidades: string[];
  setSelModalidades: (v: string[]) => void;

  selNiveles: string[];
  setSelNiveles: (v: string[]) => void;

  nivelLabel?: string;
  selPeriodos: string[];
  setSelPeriodos: (v: string[]) => void;

  facultades?: Opt[];
  selFacultades?: string[];
  setSelFacultades?: (v: string[]) => void;

  selCentros: string[];
  setSelCentros: (v: string[]) => void;

  programas?: Opt[];
  selProgramas?: string[];
  setSelProgramas?: (v: string[]) => void;

  /** ✅ ESTAS DOS SON LAS QUE FALTABAN */
  showYears?: boolean;
  showProgramas?: boolean;

  clearAll: () => void;
}


/** Botón dropdown con multiselección, buscador, seleccionar todos/limpiar, aplicar */
function DropdownMulti({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Opt[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState<string[]>(selected);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTemp(selected), [selected]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q.toLowerCase())
    );
  }, [options, q]);


  const toggle = (val: string) => {
    setTemp(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const apply = () => {
    onChange(temp);
    setOpen(false);
  };

  return (
    <div className="relative text-[11px] flex-1" ref={ref}>

      {/* 🔥 BOTÓN COMPACTO */}
<button
  onClick={() => setOpen(o => !o)}
className="h-[32px] px-2.5 border rounded-md bg-white flex items-center justify-between gap-2 text-[11px] hover:bg-gray-50 w-full">
  <div className="flex items-center gap-2 min-w-0">

    <span className="text-gray-600 text-[11px] font-medium shrink-0">
      {label}:
    </span>

    {selected.length === 0 && (
      <span className="text-gray-400 text-[11px] truncate">
        Todas
      </span>
    )}

    {selected.length > 0 && (
      <span className="flex gap-1 truncate">
        {selected.slice(0, 2).map(v => (
          <span key={v} className="bg-gray-100 px-1.5 rounded text-[10px] truncate">
            {v}
          </span>
        ))}
        {selected.length > 2 && (
          <span className="text-gray-500 text-[10px] shrink-0">
            +{selected.length - 2}
          </span>
        )}
      </span>
    )}

  </div>

  <ChevronDown size={14} className="shrink-0" />
</button>

      {/* 🔥 DROPDOWN */}
      {open && (
        <div className="absolute mt-1 w-43 bg-white border rounded-lg shadow-lg p-2 z-50">

          {/* buscador */}
          <input
            className="w-full border rounded px-2 py-1 text-[11px] mb-2"
            placeholder={`Buscar ${label}`}
            value={q}
            onChange={e => setQ(e.target.value)}
          />

          {/* lista */}
          <div className="max-h-48 overflow-auto">
            {filtered.map(o => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-2 py-1 text-[11px] hover:bg-gray-5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={temp.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>

          {/* acciones */}
          <div className="flex justify-between mt-2">
            <button
              onClick={() => setTemp([])}
              className="text-red-500 text-[11px]"
            >
              Limpiar
            </button>

            <button
              onClick={apply}
              className="bg-blue-600 text-white px-2 py-1 rounded text-[11px]"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FiltersMulti(props: FiltersMultiProps) {
  const {
  years, modalidades, niveles, periodos, centros,
  selYears, setSelYears,
  selModalidades, setSelModalidades,
  selNiveles, setSelNiveles,
  sedes, selSedes, setSelSedes,
  programas, selProgramas, setSelProgramas,
  periodicidades, selPeriodicidades, setSelPeriodicidades,
  nivelesFormacion, selNivelesFormacion, setSelNivelesFormacion,
  facultades, selFacultades, setSelFacultades,
  selPeriodos, setSelPeriodos,
  selCentros, setSelCentros,

  showYears = true,
  showProgramas = true,

  clearAll,
} = props;
  // convierte arrays string a opciones (re-uso simple)
  const toOpts = (arr: string[]) => arr.map(v => ({ label: v, value: v }));

  return (
  <div className="bg-white border-b px-2 py-1">

<div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-end [&>*]:flex-1 [&>*]:min-w-[130px]">
      <DropdownMulti label="Centro Universitario" options={centros} selected={selCentros} onChange={setSelCentros} />

{showYears && selYears && setSelYears && (
  <DropdownMulti label="Año" options={years} selected={selYears} onChange={setSelYears} />
)}

{periodos.length > 0 && (
  <DropdownMulti label="Periodo" options={periodos} selected={selPeriodos} onChange={setSelPeriodos} />
)}

{niveles.length > 0 && (
  <DropdownMulti label="Nivel Académico" options={niveles} selected={selNiveles} onChange={setSelNiveles} />
)}

<DropdownMulti label="Modalidad" options={modalidades} selected={selModalidades} onChange={setSelModalidades} />
{facultades && selFacultades && setSelFacultades && (
  <DropdownMulti
    label="Facultad"
    options={facultades}
    selected={selFacultades}
    onChange={setSelFacultades}
  />
)}

{sedes && selSedes && setSelSedes && (
  <DropdownMulti label="Sede" options={sedes} selected={selSedes} onChange={setSelSedes} />
)}

{periodicidades && periodicidades.length > 0 && setSelPeriodicidades && (
  <DropdownMulti
    label="Periodicidad"
    options={periodicidades}
    selected={selPeriodicidades ?? []}
    onChange={setSelPeriodicidades}
  />
)}

{nivelesFormacion && nivelesFormacion.length > 0 && setSelNivelesFormacion && (
  <DropdownMulti
    label="Nivel de Formación"
    options={nivelesFormacion}
    selected={selNivelesFormacion ?? []}
    onChange={setSelNivelesFormacion}
  />
)}


{showProgramas && programas && setSelProgramas && (
  <DropdownMulti
    label="Programa"
    options={programas}
    selected={selProgramas ?? []}
    onChange={setSelProgramas}
  />
)}



      {/* 🔥 BOTÓN LIMPIAR PRO */}
      <button
  onClick={clearAll}
className="h-[30px] px-2 border rounded-md text-[11px] text-xs text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 flex-1">
  <span className="flex items-center gap-1">
    <Trash2 size={12} />
    Limpiar
  </span>
</button>

    </div>

  </div>
);
}