import { useMemo } from "react";
import { Users, Database, GraduationCap, BarChart3 } from "lucide-react";
import { DataItem } from "../services/azureService";

interface StatsCardsProps {
  data: DataItem[];
}

export function StatsCards({ data = [] }: StatsCardsProps) {
  const LOCALE = "es-CO";

  const { totalEstudiantes, modalidades, niveles, programas } = useMemo(() => {
    const sumTotales = data.reduce((acc, d) => acc + (Number(d.totales) || 0), 0);

    const totalEstudiantesCalc =
      sumTotales > 0 ? sumTotales : data.length;

    const modalidadesSet = new Set(
      data.map(d => d.categoria?.trim()).filter(Boolean)
    );

    const nivelesSet = new Set(
      data.map(d => d.nivelAcademico?.trim()).filter(Boolean)
    );

    const programasSet = new Set(
      data.map(d => d.programa?.trim()).filter(Boolean)
    );

    return {
      totalEstudiantes: totalEstudiantesCalc,
      modalidades: modalidadesSet.size,
      niveles: nivelesSet.size,
      programas: programasSet.size,
    };
  }, [data]);

  const stats = [
    {
      label: "Estudiantes",
      value: totalEstudiantes,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Modalidades",
      value: modalidades,
      icon: BarChart3,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Niveles de Formación",
      value: niveles,
      icon: GraduationCap,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Programas",
      value: programas,
      icon: Database,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">

      {stats.map((stat, i) => (
        <div
          key={i}
          className="bg-white border rounded-xl px-3 py-2 flex items-center justify-between hover:shadow-sm transition"
        >
          {/* 🔹 TEXTO */}
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              {stat.label}
            </span>

            <span className="text-lg font-semibold text-gray-900 leading-tight">
              {stat.value.toLocaleString(LOCALE)}
            </span>
          </div>

          {/* 🔹 ICONO */}
          <div className={`${stat.bg} p-2 rounded-lg`}>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
        </div>
      ))}

    </div>
  );
}