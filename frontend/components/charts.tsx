"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Paleta categorica (orden fijo, nunca ciclado), validada con daltonismo simulado
 * sobre la superficie oscura de la app (#15261d). Un 9.o equipo no recibe un color
 * nuevo: se agrupa en gris como "otros".
 */
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const OTHER_COLOR = "#5c7564";
const GRID = "#29432f";
const AXIS_TEXT = "#93ab9b";
const SURFACE = "#15261d";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Marcas de eje "limpias" (0, 2, 4...) que cubren el maximo. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export interface Series {
  id: number;
  label: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

/** Grafico de lineas con cruz y tooltip al pasar el mouse (o el dedo). */
export function LineChart({
  series,
  xLabel,
  yLabel,
  height = 280,
}: {
  series: Series[];
  xLabel: (x: number) => string;
  yLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const showEndLabels = series.length <= 4;
  const margin = { top: 16, right: showEndLabels ? 120 : 16, bottom: 32, left: 40 };
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const maxX = Math.max(1, ...xs);
  const ticksY = niceTicks(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.y))));
  const maxY = ticksY[ticksY.length - 1];
  const innerW = Math.max(80, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const sx = (x: number) => margin.left + (maxX === 1 ? innerW / 2 : ((x - 1) / (maxX - 1)) * innerW);
  const sy = (y: number) => margin.top + innerH - (y / maxY) * innerH;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + margin.left;
    const nearest = xs.reduce((best, x) => (Math.abs(sx(x) - px) < Math.abs(sx(best) - px) ? x : best), xs[0]);
    setHoverX(nearest ?? null);
  };
  const hovered =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((h): h is { s: Series; p: { x: number; y: number } } => Boolean(h.p))
          .sort((a, b) => b.p.y - a.p.y);
  const tooltipLeft = hoverX !== null && sx(hoverX) > width / 2;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={`${yLabel} por partido jugado`}>
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={margin.left} x2={margin.left + innerW} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth={1} />
            <text x={margin.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={12} fill={AXIS_TEXT}>
              {t}
            </text>
          </g>
        ))}
        {xs.map((x) => (
          <text key={x} x={sx(x)} y={height - 10} textAnchor="middle" fontSize={12} fill={AXIS_TEXT}>
            {x}
          </text>
        ))}
        {hoverX !== null && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={margin.top} y2={margin.top + innerH} stroke={AXIS_TEXT} strokeWidth={1} />
        )}
        {series.map((s) => (
          <g key={s.id}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
            />
            {s.points.length > 0 && (
              <circle
                cx={sx(s.points[s.points.length - 1].x)}
                cy={sy(s.points[s.points.length - 1].y)}
                r={4}
                fill={s.color}
                stroke={SURFACE}
                strokeWidth={2}
              />
            )}
            {showEndLabels && s.points.length > 0 && (
              <text
                x={sx(s.points[s.points.length - 1].x) + 10}
                y={sy(s.points[s.points.length - 1].y)}
                dy="0.32em"
                fontSize={12}
                fill="#eaf2ec"
              >
                {s.label} · {s.points[s.points.length - 1].y}
              </text>
            )}
          </g>
        ))}
        {hovered.map(({ s, p }) => (
          <circle key={s.id} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
        ))}
        <rect
          x={margin.left - 10}
          y={margin.top}
          width={innerW + 20}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
        />
      </svg>
      {hoverX !== null && hovered.length > 0 && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={tooltipLeft ? { right: width - sx(hoverX) + 12 } : { left: sx(hoverX) + 12 }}
        >
          <p className="mb-1 font-semibold">{xLabel(hoverX)}</p>
          {hovered.map(({ s, p }) => (
            <p key={s.id} className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: s.color }} />
              <span className="flex-1 text-muted">{s.label}</span>
              <span className="font-semibold tabular-nums">{p.y}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barras horizontales de una sola serie, con el valor en la punta y tooltip. */
export function BarList({
  rows,
  color = SERIES_COLORS[0],
  unit,
}: {
  rows: Array<{ id: number; label: string; detail?: string; value: number }>;
  color?: string;
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="group grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3 text-sm" title={`${r.label}: ${r.value} ${unit}`}>
          <span className="truncate">
            {r.label}
            {r.detail && <span className="block text-xs text-muted">{r.detail}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-4 rounded-r group-hover:brightness-125"
              style={{ width: `${Math.max(2, (r.value / max) * 85)}%`, background: color }}
            />
            <span className="font-semibold tabular-nums">{r.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
