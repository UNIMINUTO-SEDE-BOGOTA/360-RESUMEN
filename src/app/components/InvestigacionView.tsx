// src/components/InvestigacionView.tsx
import { useState, useEffect, useRef } from "react";

// ── DATA ──────────────────────────────────────────────────────────────────────

const grupos = [
  { categoria: "A1", bogota: 4 },
  { categoria: "A",  bogota: 3 },
  { categoria: "B",  bogota: 15 },
  { categoria: "C",  bogota: 11 },
];
const totalGrupos = grupos.reduce((s, g) => s + g.bogota, 0);

const investigadores = [
  { nivel: "Junior",   count: 96, color: "#4472c4", icon: "🎓" },
  { nivel: "Asociado", count: 28, color: "#ed7d31", icon: "🔬" },
  { nivel: "Sénior",   count: 9,  color: "#70ad47", icon: "⭐" },
  { nivel: "Emérito",  count: 1,  color: "#ffc000", icon: "🏆" },
];
const totalInvestigadores = investigadores.reduce((s, i) => s + i.count, 0);

const patentes = [
  { id: 1, titulo: "Estufa ecológica térmica solar.", trl: 3 },
  { id: 2, titulo: "Aparato robótico flotante autopropulsado para el tratamiento de agua.", trl: 3 },
  { id: 3, titulo: "Dispositivo análogo de disco aplicable como juego de mesa o de aprendizaje.", trl: 6 },
  { id: 4, titulo: "Generador de energía eléctrica a partir de un flujo de agua de baja velocidad y caudal.", trl: 3 },
  { id: 5, titulo: "Sistema de generación de energía con piezoeléctricos dentro de la estructura interna de la llanta.", trl: 2 },
  { id: 6, titulo: "Sistema purificador de agua solar ozonificado.", trl: 7 },
  { id: 7, titulo: "Un electrolito tipo gel que comprende ácido fosfórico, grafito y un polímero de glucosa, un proceso para su obtención y una celda Electroquímica que lo comprende.", trl: 3 },
];

// ── PALETA (igual que ColaboradoresView) ──────────────────────────────────────
const C = {
  navy:    "#1a2744",
  navyDk:  "#111b36",
  blue:    "#4472c4",
  orange:  "#ed7d31",
  teal:    "#5bc4d1",
  yellow:  "#ffc000",
  green:   "#70ad47",
  purple:  "#9b59b6",
  gray:    "#a5a5a5",
  accent:  "#2e75b6",
  text:    "#1a2744",
  textLt:  "#5b6fa6",
  border:  "#d0d9f0",
  bg:      "#f0f4fb",
  white:   "#ffffff",
};

const TRL_COLORS: Record<number, string> = {
  2: C.gray,
  3: C.blue,
  6: C.green,
  7: C.yellow,
};

const TRL_LABEL: Record<number, string> = {
  2: "Concepto formulado",
  3: "Prueba experimental",
  6: "Prototipo demostrado",
  7: "Sistema en entorno real",
};

// ── COUNTER ANIMATION ─────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1200, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let frame = 0;
    const totalFrames = Math.round(duration / 16);
    const step = () => {
      frame++;
      setVal(Math.min(Math.round((frame / totalFrames) * target), target));
      if (frame < totalFrames) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

// ── ANIMATED COUNTER DISPLAY ──────────────────────────────────────────────────
function AnimCount({ target, color, started }: { target: number; color: string; started: boolean }) {
  const val = useCounter(target, 900, started);
  return <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{val}</span>;
}

// ── TRL BADGE ─────────────────────────────────────────────────────────────────
function TrlBadge({ trl }: { trl: number }) {
  const color = TRL_COLORS[trl] ?? "#6b7280";
  return (
    <span
      title={TRL_LABEL[trl] ?? `TRL ${trl}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      TRL {trl}
    </span>
  );
}

// ── DONUT CHART (SVG) ─────────────────────────────────────────────────────────
function Donut({ data, size = 100 }: { data: { value: number; color: string; label: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.16;
  let offset = -90;
  const arcs = data.map(d => {
    const angle = (d.value / total) * 360;
    const start = offset;
    offset += angle;
    return { ...d, start, angle };
  });

  const arc = (start: number, angle: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(start + angle - 0.5));
    const y2 = cy + r * Math.sin(toRad(start + angle - 0.5));
    const large = angle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={arc(a.start, a.angle)}
          fill="none"
          stroke={a.color}
          strokeWidth={stroke}
          strokeLinecap="butt"
        >
          <title>{a.label}: {a.value}</title>
        </path>
      ))}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.18} fontWeight={700} fill="#1a2744">{total}</text>
      <text x={cx} y={cy + size * 0.14} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.1} fill="#5b6fa6">total</text>
    </svg>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function InvestigacionView() {
  const [started, setStarted] = useState(false);
  const [activePatente, setActivePatente] = useState<number | null>(null);
  const [tab, setTab] = useState<"grupos" | "investigadores" | "patentes">("grupos");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const donutDataGrupos = grupos.map((g, i) => ({
    value: g.bogota,
    color: ["#ffc000", "#4472c4", "#70ad47", "#ed7d31"][i],
    label: `Cat. ${g.categoria}`,
  }));

  const donutDataInv = investigadores.map(i => ({
    value: i.count,
    color: i.color,
    label: i.nivel,
  }));

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: C.bg,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* TÍTULO */}
      <div style={{ background: C.navyDk, borderRadius: 8, padding: "12px 20px", textAlign: "center" }}>
        <div style={{ color: C.white, fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>
          SEDE UNIMINUTO BOGOTÁ – INVESTIGACIÓN
        </div>
        <div style={{ color: "#7ea8d8", fontSize: 12, marginTop: 2 }}>
          Grupos categorizados · Minciencias · Convocatoria 957 de 2024
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
        {(["grupos", "investigadores", "patentes"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.15s",
              background: tab === t ? C.navy : C.white,
              color: tab === t ? C.white : C.textLt,
              boxShadow: tab === t ? `0 2px 8px ${C.navy}44` : "none",
            }}
          >
            {t === "grupos" ? "📊 Grupos" : t === "investigadores" ? "🔬 Investigadores" : "📜 Patentes 2025"}
          </button>
        ))}
      </div>

      {/* ── TAB: GRUPOS ── */}
      {tab === "grupos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}>
            {/* Donut + total */}
            <div style={{
              background: C.white,
              borderRadius: 8,
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, color: C.textLt, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Distribución</div>
              <Donut data={donutDataGrupos} size={110} />
              <div style={{ fontSize: 11, color: C.textLt }}>Grupos categorizados Bogotá</div>
            </div>

            {/* Category bars */}
            <div style={{
              background: C.white,
              borderRadius: 8,
              padding: "16px",
              border: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontSize: 11, color: C.textLt, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
                Por Categoría — Bogotá
              </div>
              {grupos.map((g, i) => {
                const pct = Math.round((g.bogota / totalGrupos) * 100);
                const color = ["#ffc000", "#4472c4", "#70ad47", "#ed7d31"][i];
                return (
                  <div key={g.categoria}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: C.text }}>Cat. {g.categoria}</span>
                      <span style={{ color, fontWeight: 800 }}>{g.bogota}</span>
                    </div>
                    <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: started ? `${pct}%` : "0%",
                        background: color,
                        borderRadius: 4,
                        transition: "width 1s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                  </div>
                );
              })}
              <div style={{
                marginTop: 6,
                paddingTop: 10,
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 800,
              }}>
                <span style={{ color: C.navy }}>Total</span>
                <span style={{ color: C.accent }}>{totalGrupos}</span>
              </div>
            </div>
          </div>

          {/* Big KPI */}
          <div style={{
            background: "#eef3fb",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
              <AnimCount target={totalGrupos} color={C.accent} started={started} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Grupos Categorizados</div>
              <div style={{ fontSize: 11, color: C.textLt, marginTop: 2 }}>
                Reconocidos en Minciencias · Convocatoria 957 de 2024
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: INVESTIGADORES ── */}
      {tab === "investigadores" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}>
            {investigadores.map(inv => (
              <div
                key={inv.nivel}
                style={{
                  background: C.white,
                  border: `1px solid ${inv.color}55`,
                  borderRadius: 8,
                  padding: "18px 12px",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 18px ${inv.color}33`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(180deg, ${inv.color}10 0%, transparent 60%)`,
                  pointerEvents: "none",
                }} />
                <div style={{ fontSize: 26, marginBottom: 6 }}>{inv.icon}</div>
                <div style={{
                  fontSize: 38,
                  fontWeight: 900,
                  color: inv.color,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  <AnimCount target={inv.count} color={inv.color} started={started} />
                </div>
                <div style={{ fontSize: 12, color: C.textLt, marginTop: 6, fontWeight: 600 }}>
                  {inv.nivel}
                </div>
                <div style={{ marginTop: 8, height: 4, background: C.border, borderRadius: 2 }}>
                  <div style={{
                    height: "100%",
                    width: started ? `${(inv.count / totalInvestigadores) * 100}%` : "0%",
                    background: inv.color,
                    borderRadius: 2,
                    transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={{
              flex: 1,
              minWidth: 200,
              background: C.white,
              borderRadius: 8,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 16,
              border: `1px solid ${C.border}`,
            }}>
              <Donut data={donutDataInv} size={90} />
              <div style={{ flex: 1 }}>
                {investigadores.map(inv => (
                  <div key={inv.nivel} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: inv.color, flexShrink: 0 }} />
                    <span style={{ color: C.text, flex: 1 }}>{inv.nivel}</span>
                    <span style={{ color: inv.color, fontWeight: 700 }}>{inv.count}</span>
                    <span style={{ color: C.textLt, fontSize: 10 }}>
                      ({Math.round((inv.count / totalInvestigadores) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              background: "#eef3fb",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "14px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                Total Investigadores
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: C.accent, lineHeight: 1.1 }}>
                <AnimCount target={totalInvestigadores} color={C.accent} started={started} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PATENTES ── */}
      {tab === "patentes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
            background: C.navy,
            borderRadius: 8,
            padding: "8px 14px",
          }}>
            <div style={{ color: C.white, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>PATENTES EN 2025</div>
            <div style={{
              background: C.yellow,
              color: C.navy,
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: 1,
            }}>TRL</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "#7ea8d8" }}>{patentes.length} patentes</div>
          </div>

          {patentes.map((p) => (
            <div
              key={p.id}
              onClick={() => setActivePatente(activePatente === p.id ? null : p.id)}
              style={{
                background: activePatente === p.id ? "#eef3fb" : C.white,
                border: `1px solid ${activePatente === p.id ? C.accent : C.border}`,
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                if (activePatente !== p.id)
                  (e.currentTarget as HTMLDivElement).style.background = "#f5f8ff";
              }}
              onMouseLeave={e => {
                if (activePatente !== p.id)
                  (e.currentTarget as HTMLDivElement).style.background = C.white;
              }}
            >
              <div style={{
                minWidth: 24,
                height: 24,
                borderRadius: "50%",
                background: C.navy,
                color: C.white,
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>{p.id}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{p.titulo}</div>
                {activePatente === p.id && (
                  <div style={{ marginTop: 6, fontSize: 11, color: C.textLt, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      background: (TRL_COLORS[p.trl] ?? C.gray) + "22",
                      color: TRL_COLORS[p.trl] ?? C.gray,
                      border: `1px solid ${TRL_COLORS[p.trl] ?? C.gray}55`,
                      borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700
                    }}>Nivel TRL {p.trl}</span>
                    <span>{TRL_LABEL[p.trl] ?? ""}</span>
                  </div>
                )}
              </div>

              <TrlBadge trl={p.trl} />
            </div>
          ))}

          <div style={{ fontSize: 10, color: C.textLt, marginTop: 4, textAlign: "right" }}>
            Fuente: Dirección de Investigación · Noviembre de 2025
          </div>
        </div>
      )}
    </div>
  );
}
export default InvestigacionView;
