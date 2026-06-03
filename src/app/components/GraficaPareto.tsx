// src/app/components/GraficaPareto.tsx
import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell, Legend
} from "recharts";

interface Props {
  titulo: string;
  colorHeader: string;
  data: any[];
}

export function GraficaPareto({ titulo, colorHeader, data }: Props) {
  const [highlightBar, setHighlightBar] = useState(false);
  const [highlightLine, setHighlightLine] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className={`${colorHeader} text-white text-xs px-3 py-2 font-medium`}>
        {titulo}
      </div>
      <div className="p-2 overflow-x-auto">
        <div style={{ minWidth: "520px" }}>
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
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
                {data.map((entry, index) => {
                  const baseColor = entry.fill;
                  const darkColor = baseColor === "#22c55e" ? "#15803d"
                    : baseColor === "#a855f7" ? "#7e22ce"
                    : "#2563eb";
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
  );
}
