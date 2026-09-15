import { useRef, useState } from "react";
import { Download } from "lucide-react";

interface DownloadableChartProps {
  children: React.ReactNode;
  fileName: string;
  className?: string;
}

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function elementToPng(element: HTMLElement, fileName: string) {
  if (document.fonts?.ready) await document.fonts.ready;

  const sourceSvg =
    element.querySelector<SVGSVGElement>("svg.recharts-surface") ||
    element.querySelector<SVGSVGElement>("svg");
  if (!sourceSvg) throw new Error("No se encontró una gráfica SVG para descargar");

  const rect = sourceSvg.getBoundingClientRect();
  const chartWidth = Math.ceil(rect.width);
  const width = Math.max(chartWidth, 420);
  const chartHeight = Math.ceil(rect.height);
  const legendItems = Array.from(
    element.querySelectorAll<HTMLElement>(".recharts-legend-item-text"),
  )
    .map((item) => item.textContent?.trim())
    .filter((item): item is string => Boolean(item));

  const titleHeight = 42;
  const legendHeight = legendItems.length ? legendItems.length * 18 + 8 : 0;
  const height = titleHeight + legendHeight + chartHeight;
  if (!width || !height) throw new Error("La gráfica no está visible");

  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(chartWidth));
  clone.setAttribute("height", String(chartHeight));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  }

  const sourceElements = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll("*"))];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll("*"))];
  const presentationProperties = [
    "color", "fill", "fill-opacity", "font-family", "font-size", "font-style",
    "font-weight", "opacity", "stroke", "stroke-dasharray", "stroke-linecap",
    "stroke-linejoin", "stroke-opacity", "stroke-width", "text-anchor",
  ];

  sourceElements.forEach((source, index) => {
    const target = cloneElements[index] as SVGElement | undefined;
    if (!target) return;
    const computed = window.getComputedStyle(source);
    presentationProperties.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value) target.style.setProperty(property, value);
    });
  });

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );

  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No fue posible interpretar la gráfica SVG"));
      image.src = svgUrl;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite crear la imagen");

    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#1e293b";
    context.font = "600 14px 'Segoe UI', Arial, sans-serif";
    context.fillText(fileName, 12, 25, Math.max(0, width - 24));

    if (legendItems.length) {
      context.font = "11px 'Segoe UI', Arial, sans-serif";
      legendItems.forEach((item, index) => {
        context.fillText(`• ${item}`, 16, titleHeight + 14 + index * 18, Math.max(0, width - 32));
      });
    }

    context.drawImage(
      image,
      (width - chartWidth) / 2,
      titleHeight + legendHeight,
      chartWidth,
      chartHeight,
    );

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No fue posible crear el archivo PNG"))),
        "image/png",
      );
    });

    const pngUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = pngUrl;
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
      .join("-");
    link.download = `${safeFileName(fileName) || "grafica"}-${date}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function DownloadableChart({ children, fileName, className = "" }: DownloadableChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!chartRef.current || downloading) return;
    setDownloading(true);
    try {
      await elementToPng(chartRef.current, fileName);
    } catch (error) {
      console.error("Error descargando la gráfica:", error);
      window.alert("No fue posible descargar la gráfica. Intenta nuevamente.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex justify-end px-2 pt-2">
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          title={`Descargar ${fileName} como PNG`}
        >
          <Download size={14} aria-hidden="true" />
          {downloading ? "Generando…" : "Descargar gráfica"}
        </button>
      </div>
      <div ref={chartRef}>{children}</div>
    </div>
  );
}
