interface MarqueeBannerProps {
  titulo?: string;
  fechaCorte?: string;
  textoCompleto?: string;
}

export function MarqueeBanner({
  titulo = "Sistema Integrado de Información",
  fechaCorte,
  textoCompleto,
}: MarqueeBannerProps) {
  const texto = textoCompleto
    ? textoCompleto
    : fechaCorte
    ? `${titulo} · Corte: ${fechaCorte}`
    : titulo;

  return (
    <div className="sticky top-[56px] sm:top-[80px] z-40 bg-slate-900 text-white text-xs overflow-hidden border-y">
      <div className="overflow-hidden">
        <div
          className="flex whitespace-nowrap"
          style={{ animation: "marquee 30s linear infinite", width: "max-content" }}
        >
          {[...Array(6)].map((_, i) => (
            <span key={i} className="px-6">
              {texto}
            </span>
          ))}
          {[...Array(6)].map((_, i) => (
            <span key={`d-${i}`} className="px-6">
              {texto}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MarqueeBanner;
