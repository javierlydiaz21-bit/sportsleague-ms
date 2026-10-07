// Escudo de cada equipo: un círculo con su color y sus iniciales. El color sale del
// nombre, así el mismo equipo siempre se ve igual en toda la web.

const PALETTE = [
  "#1F3FBF",
  "#D06A2C",
  "#B42E35",
  "#B98C2A",
  "#5B3CC4",
  "#0E7A55",
  "#2E86C1",
  "#7A1F3D",
  "#C9A93A",
  "#55607A",
  "#9C3D12",
  "#1D5E3A",
  "#11667A",
  "#A3306A",
];
const PREFIX = ["real", "atletico", "juventud", "deportivo", "union", "racing", "independiente", "club"];
const SKIP = ["fc", "de", "del", "la", "el"];

export function initials(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((w) => w && !SKIP.includes(w.toLowerCase()));
  if (!words.length) return "?";
  if (words.length > 1 && PREFIX.includes(words[0].toLowerCase())) return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

/** Texto oscuro sobre colores claros y blanco sobre los oscuros. */
function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? "#0E1630" : "#FFFFFF";
}

function colorOf(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Crest({ name, size = 32 }: { name: string; size?: number }) {
  const c = colorOf(name);
  return (
    <span className="crest" style={{ "--s": `${size}px`, "--c1": c, "--c2": inkFor(c) } as React.CSSProperties} aria-hidden>
      {initials(name)}
    </span>
  );
}
