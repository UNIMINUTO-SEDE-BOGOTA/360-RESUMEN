// src/components/ParetoTablas.tsx
interface Props {
  pareto80: { pregrado: ParetoItem[]; posgrado: ParetoItem[] };
  pareto20: { pregrado: ParetoItem[]; posgrado: ParetoItem[] };
}

function TablaPareto({ titulo, datos, color }: { 
  titulo: string; 
  datos: ParetoItem[]; 
  color: string 
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className={`${color} text-white text-xs px-3 py-2 font-medium`}>{titulo}</div>
      <div className="overflow-y-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left text-slate-500 font-medium w-8">No.</th>
              <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Programa</th>
              <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Est.</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((p, i) => (
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
                {datos.reduce((a, b) => a + b.valor, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function ParetoTablas({ pareto80, pareto20 }: Props) {
  return (
    <div className="flex flex-col gap-3">

      {/* PREGRADO */}
      <div className="border border-blue-100 rounded-lg p-2 bg-blue-50/30">
        <p className="text-[11px] font-semibold text-blue-700 mb-2 uppercase tracking-wide">
          Pregrado
        </p>
        <div className="flex flex-col gap-2">
          <TablaPareto
            titulo="Programas con el 80% de estudiantes nuevos"
            datos={pareto80.pregrado}
            color="bg-slate-700"
          />
          <TablaPareto
            titulo="Programas con el 20% de estudiantes nuevos"
            datos={pareto20.pregrado}
            color="bg-slate-600"
          />
        </div>
      </div>

      {/* POSGRADO */}
      <div className="border border-purple-100 rounded-lg p-2 bg-purple-50/30">
        <p className="text-[11px] font-semibold text-purple-700 mb-2 uppercase tracking-wide">
          Posgrado
        </p>
        <div className="flex flex-col gap-2">
          <TablaPareto
            titulo="Programas con el 80% de estudiantes nuevos"
            datos={pareto80.posgrado}
            color="bg-purple-700"
          />
          <TablaPareto
            titulo="Programas con el 20% de estudiantes nuevos"
            datos={pareto20.posgrado}
            color="bg-purple-600"
          />
        </div>
      </div>

    </div>
  );
}
