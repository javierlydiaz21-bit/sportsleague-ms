// Ilustración de la banda del inicio: la cancha del deporte de la liga activa en trazo fino,
// como una pizarra táctica (jugadores, la jugada en línea punteada y el balón en dorado).
// Las canchas se dibujan en metros con sus medidas reglamentarias y se escalan a un mismo alto.

import type { CSSProperties, ReactNode } from "react";

type Court = {
  label: string;
  /** Largo y ancho de la cancha, en metros. */
  w: number;
  h: number;
  /** Líneas de la cancha (en metros). */
  lines: ReactNode;
  /** Jugada: recibe el radio de un jugador en metros para que todos se vean del mismo tamaño. */
  play: (r: number) => ReactNode;
};

const COURTS: Record<string, Court> = {
  basquet: {
    label: "Cancha de básquet",
    w: 28,
    h: 15,
    lines: (
      <>
        <rect width="28" height="15" />
        <path d="M14 0V15" />
        <circle cx="14" cy="7.5" r="1.8" />
        <rect y="5.05" width="5.8" height="4.9" />
        <rect x="22.2" y="5.05" width="5.8" height="4.9" />
        <circle cx="5.8" cy="7.5" r="1.8" />
        <circle cx="22.2" cy="7.5" r="1.8" />
        <path d="M0 0.9H2.99A6.75 6.75 0 0 1 2.99 14.1H0M28 0.9H25.01A6.75 6.75 0 0 0 25.01 14.1H28" />
        <path d="M1.2 6.6V8.4M26.8 6.6V8.4" />
        <circle className="gold-line" cx="1.575" cy="7.5" r="0.3" />
        <circle className="gold-line" cx="26.425" cy="7.5" r="0.3" />
      </>
    ),
    play: (r) => (
      <>
        {[[17, 3.6], [19.2, 12], [24, 2.8], [24.6, 12.4], [21, 8.6]].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="player" cx={x} cy={y} r={r} />
        ))}
        <path className="move" d="M17.5 4.1Q20.4 4.8 20.9 7.6" />
        <path className="move" d="M22.1 8.6Q24.2 3.6 26.2 7.1" />
        <circle className="ball" cx="21.8" cy="9.2" r={r * 0.75} />
      </>
    ),
  },
  futbol: {
    label: "Cancha de fútbol",
    w: 105,
    h: 68,
    lines: (
      <>
        <rect width="105" height="68" />
        <path d="M52.5 0V68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect y="13.84" width="16.5" height="40.32" />
        <rect x="88.5" y="13.84" width="16.5" height="40.32" />
        <rect y="24.84" width="5.5" height="18.32" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <path d="M16.5 26.69A9.15 9.15 0 0 1 16.5 41.31M88.5 26.69A9.15 9.15 0 0 0 88.5 41.31" />
        <path className="gold-line" d="M0 30.34H-2V37.66H0M105 30.34H107V37.66H105" />
      </>
    ),
    play: (r) => (
      <>
        {[[60, 16], [68, 52], [86, 9], [90, 50], [80, 34]].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="player" cx={x} cy={y} r={r} />
        ))}
        <path className="move" d="M62.5 17.5Q76 18 79 31" />
        <path className="move" d="M85 35.6Q95 30 104 33" />
        <circle className="ball" cx="83.2" cy="37" r={r * 0.75} />
      </>
    ),
  },
  voley: {
    label: "Cancha de vóley",
    w: 18,
    h: 9,
    lines: (
      <>
        <rect width="18" height="9" />
        <path d="M6 0V9M12 0V9" />
        <path className="net" d="M9 -0.7V9.7" />
        <circle className="gold-line" cx="9" cy="-0.7" r="0.18" />
        <circle className="gold-line" cx="9" cy="9.7" r="0.18" />
      </>
    ),
    play: (r) => (
      <>
        {[[1.8, 1.6], [1.8, 4.5], [1.8, 7.4], [5.2, 1.6], [5.2, 4.5], [5.2, 7.4]].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="player" cx={x} cy={y} r={r} />
        ))}
        <path className="move" d="M5.6 4.2Q9 0.4 13.6 2.3" />
        <circle className="ball" cx="14.1" cy="2.6" r={r * 0.75} />
      </>
    ),
  },
};

/** Alto de la cancha en el dibujo y margen alrededor (unidades del viewBox, cercanas a píxeles). */
const HEIGHT = 150;
const PAD = 14;

export function CourtArt({ sport }: { sport?: string }) {
  const court = COURTS[sport ?? ""] ?? COURTS.futbol;
  const k = HEIGHT / court.h;
  const width = court.w * k + PAD * 2;
  const height = HEIGHT + PAD * 2;
  // Grosor y punteado en unidades del dibujo: se dividen por la escala para que se vean igual en las tres canchas
  const style = { aspectRatio: `${width} / ${height}`, "--dash": `${3 / k} ${4 / k}` } as CSSProperties;
  return (
    <svg className="court-art" viewBox={`${-PAD} ${-PAD} ${width} ${height}`} style={style} role="img" aria-label={court.label}>
      <g transform={`scale(${k})`} strokeWidth={1.4 / k}>
        {court.lines}
        {court.play(5 / k)}
      </g>
    </svg>
  );
}
