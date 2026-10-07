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
