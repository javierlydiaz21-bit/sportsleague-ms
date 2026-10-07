// Íconos de línea del diseño "liga oficial": uno por sección, acorde a su nombre.

export type IconId =
  | "inicio"
  | "ligas"
  | "equipos"
  | "arbitros"
  | "calendario"
  | "partidos"
  | "estadisticas"
  | "publico"
  | "balon"
  | "avisos";

const PATHS: Record<IconId, React.ReactNode> = {
  inicio: <path d="M4 10.4 12 4l8 6.4V20h-5.2v-5.6H9.2V20H4z" />,
  ligas: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.6a.6.6 0 0 0-.6.6V7a3 3 0 0 0 3 3M16 6h2.4a.6.6 0 0 1 .6.6V7a3 3 0 0 1-3 3" />
      <path d="M12 13v3" />
      <path d="M8.6 20h6.8l-.5-2.9a1.4 1.4 0 0 0-1.4-1.1h-3a1.4 1.4 0 0 0-1.4 1.1z" />
    </>
  ),
  equipos: (
    <>
      <path d="M9 3.6 5.6 4.9 3 9.2l2.9 1.5L7.4 9.6V20h9.2V9.6l1.5 1.1L21 9.2l-2.6-4.3L15 3.6a3 3 0 0 1-6 0z" />
      <path d="M10.5 13.5h3" />
    </>
  ),
  arbitros: (
    <>
      <circle cx="9.5" cy="14.5" r="5" />
      <circle cx="9.5" cy="14.5" r="1.4" />
      <path d="M12.7 10.6 14.6 9h5.9v3.6h-5.2" />
      <path d="M5.4 11.6 3.6 9.8" />
      <rect x="16.2" y="2.8" width="3.4" height="4.6" rx=".6" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13h.01M12 13h.01M8 16.5h.01M12 16.5h.01" strokeWidth="2.4" />
      <rect x="14.6" y="12.2" width="3.2" height="3.2" rx=".7" />
    </>
  ),
  partidos: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
      <path d="M9 4.5v-.7A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8v.7" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
    </>
  ),
  estadisticas: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3" height="5.5" rx=".6" />
      <rect x="10.5" y="8.5" width="3" height="9" rx=".6" />
      <rect x="15.5" y="5" width="3" height="12.5" rx=".6" />
    </>
  ),
  publico: (
    <>
      <path d="M4 10.2v3.6a1 1 0 0 0 1 1h2.2L15 19V5L7.2 9.2H5a1 1 0 0 0-1 1z" />
      <path d="M8 14.8 9 19h2.2l-.8-3.6" />
      <path d="M18 9.2a4 4 0 0 1 0 5.6M20.2 7a7 7 0 0 1 0 10" />
    </>
  ),
  balon: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.4l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" />
      <path d="M12 3.5v4.9M15.2 10.7l4.5-1.4M14 14.5l2.7 3.8M10 14.5l-2.7 3.8M8.8 10.7 4.3 9.3" />
    </>
  ),
  avisos: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
};

export function Icon({ id }: { id: IconId }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {PATHS[id]}
    </svg>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x=".5" y=".5" width="31" height="31" rx="9" fill="#0E1630" stroke="rgba(238,241,247,.28)" />
      <path d="M16 6v20" stroke="#EEF1F7" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="5.6" fill="none" stroke="#EEF1F7" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.9" fill="#B58A2E" />
    </svg>
  );
}

/** Cancha en trazo fino para las bandas en azul tinta. */
export function Pitch() {
  return (
    <svg className="pitch" viewBox="0 0 600 380" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <rect x="10" y="10" width="580" height="360" rx="3" />
      <path d="M300 10V370" />
      <circle cx="300" cy="190" r="58" />
      <rect x="10" y="98" width="92" height="184" />
      <rect x="498" y="98" width="92" height="184" />
      <rect x="10" y="148" width="34" height="84" />
      <rect x="556" y="148" width="34" height="84" />
      <path d="M102 150a48 48 0 0 1 0 80M498 150a48 48 0 0 0 0 80" />
    </svg>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 6.2 5 8.5l4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
