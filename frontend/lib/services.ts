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

export const STATUS_LABEL: Record<MatchStatus, string> = {
  programado: "Programado",
  en_curso: "En vivo",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
};

export const STATUS_CLASS: Record<MatchStatus, string> = {
  programado: "bg-surface-2 text-muted",
  en_curso: "bg-live/15 text-live",
  finalizado: "bg-ok/15 text-ok",
  suspendido: "bg-async/15 text-async",
};
