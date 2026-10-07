import type { MatchStatus } from "./types";

/**
 * URL del API Gateway (documento 8.1: NEXT_PUBLIC_API_URL). Es el unico punto de
 * entrada: el frontend nunca llama directamente a un microservicio. En local, sin
 * la variable, se usa el gateway de docker compose.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

/** GET publico con timeout (paginas del servidor). Devuelve null si falla. */
export async function getJson<T>(path: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);
export const utcDay = (iso: string) => DAYS[new Date(iso).getUTCDay()];

const fmtLong = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtShort = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "sábado, 26 de septiembre" */
export const longDate = (iso: string) => fmtLong.format(new Date(`${utcDate(iso)}T00:00:00Z`));
/** "26 sept 2026" */
export const shortDate = (iso: string) => fmtShort.format(new Date(`${utcDate(iso)}T00:00:00Z`)).replace(/\./g, "");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Edad cumplida en una fecha (por defecto, hoy). */
export function ageAt(birthDate: string, at = new Date().toISOString().slice(0, 10)) {
  const [by, bm, bd] = utcDate(birthDate).split("-").map(Number);
  const [y, m, d] = at.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  programado: "Programado",
  en_curso: "En curso",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
};

export const SPORT_LABEL: Record<string, string> = { futbol: "Fútbol", basquet: "Básquet", voley: "Vóley" };

export const TIEBREAKER_LABEL: Record<string, string> = {
  diferencia_de_goles: "diferencia de goles",
  goles_a_favor: "goles a favor",
  partidos_ganados: "partidos ganados",
};
