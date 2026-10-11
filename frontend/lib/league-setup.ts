// Lógica del flujo de ligas: Mis ligas, creación rápida y configuración guiada.
// Es código puro (sin React ni alias "@/") para probarlo con node:test: `npm test`.
// El estado de cada etapa sale de datos guardados en los servicios, nunca de lo que haya en pantalla.

export const SPORTS: Record<string, string> = { futbol: "Fútbol", basquet: "Básquet", voley: "Vóley" };

/** Criterios de desempate que reconoce el Statistics Service (standings.util.ts). */
export const TIEBREAKERS: Record<string, string> = {
  diferencia_de_goles: "Diferencia de goles",
  goles_a_favor: "Goles a favor",
  partidos_ganados: "Partidos ganados",
};

export type StageId = "temporada" | "categorias" | "reglamento" | "equipos" | "calendario" | "revision";
export type StageState = "completada" | "pendiente" | "atencion";

export interface Stage {
  id: StageId;
  label: string;
  state: StageState;
  detail: string;
}

export interface SetupData {
  seasons: { id: number; year: number }[];
  categories: { id: number; name: string; rule?: unknown | null }[];
  /** Equipos registrados por categoría (Team Service). */
  teamsPerCategory: Record<number, number>;
  /** Partidos del calendario por temporada (Fixture Service). */
  matchesPerSeason: Record<number, number>;
  /** Árbitros certificados en alguna categoría de la liga (Referee Service). */
  referees: number;
}

export const STAGE_LABELS: Record<StageId, string> = {
  temporada: "Temporada",
  categorias: "Categorías",
  reglamento: "Reglamento",
  equipos: "Equipos",
  calendario: "Calendario y arbitraje",
  revision: "Revisión",
};

export const STAGE_ORDER: StageId[] = ["temporada", "categorias", "reglamento", "equipos", "calendario", "revision"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const names = (list: { name: string }[]) => list.map((x) => x.name).join(", ");

/** Estado de las seis etapas de la configuración guiada. */
export function setupStages(d: SetupData): Stage[] {
  const stage = (id: StageId, state: StageState, detail: string): Stage => ({ id, label: STAGE_LABELS[id], state, detail });
  const out: Stage[] = [];

  out.push(
    d.seasons.length
      ? stage("temporada", "completada", d.seasons.map((s) => s.year).sort().join(", "))
      : stage("temporada", "pendiente", "Define el año y las fechas"),
  );

  if (!d.categories.length) {
    out.push(stage("categorias", "pendiente", d.seasons.length ? "Crea al menos una categoría" : "Primero crea una temporada"));
  } else {
    out.push(stage("categorias", "completada", names(d.categories)));
  }

  const noRule = d.categories.filter((c) => !c.rule);
  if (!d.categories.length) out.push(stage("reglamento", "pendiente", "Primero crea una categoría"));
  else if (noRule.length) out.push(stage("reglamento", noRule.length === d.categories.length ? "pendiente" : "atencion", `Falta en ${names(noRule)}`));
  else out.push(stage("reglamento", "completada", "Puntos y desempate definidos"));

  const counts = d.categories.map((c) => ({ c, n: d.teamsPerCategory[c.id] ?? 0 }));
  const short = counts.filter((x) => x.n < 2);
  const total = counts.reduce((s, x) => s + x.n, 0);
  if (!d.categories.length) out.push(stage("equipos", "pendiente", "Primero crea una categoría"));
  else if (!short.length) out.push(stage("equipos", "completada", plural(total, "equipo", "equipos")));
  else if (short.length < counts.length) out.push(stage("equipos", "atencion", `Faltan equipos en ${names(short.map((x) => x.c))} (mínimo 2)`));
  else out.push(stage("equipos", "pendiente", "Registra al menos 2 equipos por categoría"));

  const matches = Object.values(d.matchesPerSeason).reduce((s, n) => s + n, 0);
  // Basta una categoría con 2 equipos para generar su calendario
  if (!matches) out.push(stage("calendario", "pendiente", out[3].state !== "pendiente" ? "Genera el calendario" : "Primero registra los equipos"));
  else if (!d.referees) out.push(stage("calendario", "atencion", `${plural(matches, "partido", "partidos")}, sin árbitros certificados`));
  else out.push(stage("calendario", "completada", `${plural(matches, "partido", "partidos")}, ${plural(d.referees, "árbitro", "árbitros")}`));

  const missing = out.filter((s) => s.state !== "completada").length;
  out.push(
    missing
      ? stage("revision", "pendiente", `${plural(missing, "etapa", "etapas")} por completar`)
      : stage("revision", "completada", "Lista para operar"),
  );
  return out;
}

/** Resumen para Mis ligas: etapas completas (de las cinco de configuración) y si ya puede operar. */
export function leagueStatus(stages: Stage[]) {
  const work = stages.filter((s) => s.id !== "revision");
  const done = work.filter((s) => s.state === "completada").length;
  return { done, total: work.length, ready: done === work.length };
}

/** Etapa en la que conviene retomar: la primera sin completar. */
export function firstOpenStage(stages: Stage[]): StageId {
  return stages.find((s) => s.state !== "completada")?.id ?? "revision";
}

/** Nombre comparable: sin tildes, sin mayúsculas y sin espacios de sobra. */
export function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Una liga propia con un nombre igual o casi igual (para avisar antes de crear otra). */
export function similarLeague<T extends { name: string }>(name: string, leagues: T[]): T | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return leagues.find((l) => {
    const m = normalizeName(l.name);
    return m === n || (Math.min(m.length, n.length) >= 6 && distance(m, n) <= 2);
  });
}

// Validaciones de los formularios (devuelven el mensaje para la persona, o null si todo está bien)

export function validateLeague(name: string, sport: string): string | null {
  const n = name.trim();
  if (!n) return "Escribe el nombre de tu liga.";
  if (n.length < 2) return "El nombre debe tener al menos 2 caracteres.";
  if (n.length > 80) return "El nombre puede tener hasta 80 caracteres.";
  if (!SPORTS[sport]) return "Elige el deporte de la liga.";
  return null;
}

export function validateSeason(year: number, start: string, end: string): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return "Escribe un año entre 2000 y 2100.";
  if (!start || !end) return "Elige la fecha de inicio y la de fin.";
  if (start >= end) return "La fecha de fin debe ser posterior a la de inicio.";
  if (year !== Number(start.slice(0, 4)) && year !== Number(end.slice(0, 4))) {
    return "El año de la temporada debe coincidir con el año de inicio o con el de fin.";
  }
  return null;
}

export function validateCategory(name: string, min: number, max: number, existing: string[]): string | null {
  const n = name.trim();
  if (!n) return "Escribe el nombre de la categoría.";
  if (n.length > 40) return "El nombre de la categoría puede tener hasta 40 caracteres.";
  if (existing.some((e) => normalizeName(e) === normalizeName(n))) return `Ya existe la categoría ${n} en esta liga.`;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return "Escribe las edades como números enteros.";
  if (min < 3 || max > 99) return "Las edades deben estar entre 3 y 99 años.";
  if (min > max) return "La edad mínima no puede ser mayor que la máxima.";
  return null;
}

export function validateRule(pointsWin: number, pointsDraw: number, tiebreaker: string): string | null {
  if (!Number.isInteger(pointsWin) || pointsWin < 1 || pointsWin > 10) return "Los puntos por victoria deben ser un número entero entre 1 y 10.";
  if (!Number.isInteger(pointsDraw) || pointsDraw < 0 || pointsDraw > pointsWin) {
    return "Los puntos por empate deben ser un número entero entre 0 y los puntos por victoria.";
  }
  if (!TIEBREAKERS[tiebreaker]) return "Elige un criterio de desempate.";
  return null;
}
