// Escudo generado para cada equipo: forma de escudo, color propio y sus iniciales.
// El color sale del nombre, asi el mismo equipo siempre se ve igual en toda la web.

const COLORS = [
  { bg: "#c8353b", fg: "#ffffff" }, // rojo
  { bg: "#2f6fd6", fg: "#ffffff" }, // azul
  { bg: "#2e9e5b", fg: "#ffffff" }, // verde
  { bg: "#e3b33b", fg: "#1d1500" }, // amarillo
  { bg: "#7b5cd6", fg: "#ffffff" }, // morado
  { bg: "#e07b39", fg: "#1f0d00" }, // naranja
  { bg: "#1f9e9a", fg: "#ffffff" }, // turquesa
  { bg: "#8e2c48", fg: "#ffffff" }, // vinotinto
  { bg: "#23407a", fg: "#ffffff" }, // azul oscuro
  { bg: "#e8e8e8", fg: "#1a1a1a" }, // blanco
];

const SKIP = new Set(["fc", "cf", "club", "de", "del", "la", "el", "los", "las", "y", "sc", "cd", "deportivo", "atlético", "atletico"]);

export function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !SKIP.has(w.toLowerCase()));
  const use = main.length ? main : words;
  return (use.length === 1 ? use[0].slice(0, 3) : use.slice(0, 2).map((w) => w[0]).join("")).toUpperCase();
}

function colorOf(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export default function Crest({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const { bg, fg } = colorOf(name);
  const text = initials(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path d="M16 1.5 L29 6 V15.5 C29 23.5 23 28.5 16 30.5 C9 28.5 3 23.5 3 15.5 V6 Z" fill={bg} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      <path d="M16 3.6 L27 7.4 V15.5 C27 22.2 22 26.6 16 28.4" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.2" />
      <text
        x="16"
        y="19.5"
        textAnchor="middle"
        fontSize={text.length > 2 ? 9.5 : 11.5}
        fontWeight="700"
        fill={fg}
        fontFamily="var(--font-barlow-condensed), Arial Narrow, sans-serif"
      >
        {text}
      </text>
    </svg>
  );
}
