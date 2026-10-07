// Gráficos pequeños del panel. Una sola serie por gráfico, en verde cancha
// (validado contra la superficie blanca: contraste >= 3:1); el texto va en tinta.

/**
 * Línea de evolución de un equipo (puntos acumulados por partido). Todas las
 * líneas comparten el mismo máximo, así se comparan entre sí.
 */
export function Spark({ series, max, label }: { series: number[]; max: number; label: string }) {
  const n = Math.max(series.length - 1, 1);
  const points = series.map((v, i) => `${((i / n) * 100).toFixed(1)},${(28 - (v / Math.max(max, 1)) * 26).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={points} fill="none" stroke="#0E7A55" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Barras horizontales de una sola serie, con el valor en la punta y el detalle al pasar el mouse. */
export function BarList({ rows, unit }: { rows: Array<{ id: number; label: string; value: number }>; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.id} title={`${r.label}: ${r.value.toLocaleString("es-CO")} ${unit}`}>
          <span>{r.label}</span>
          <span className="bar">
            <i style={{ width: `${Math.max(2, (r.value / max) * 82)}%` }} />
            {r.value.toLocaleString("es-CO")}
          </span>
        </li>
      ))}
    </ul>
  );
}
