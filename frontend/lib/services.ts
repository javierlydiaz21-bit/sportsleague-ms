export type ServiceKey = "fixture" | "referee" | "league" | "team";

export const SERVICES: { key: ServiceKey; name: string; env: string; local: string }[] = [
  { key: "league", name: "League Service", env: "LEAGUE_SERVICE_URL", local: "http://localhost:3003" },
  { key: "team", name: "Team Service", env: "TEAM_SERVICE_URL", local: "http://localhost:3004" },
  { key: "fixture", name: "Fixture Service", env: "FIXTURE_SERVICE_URL", local: "http://localhost:3001" },
  { key: "referee", name: "Referee Service", env: "REFEREE_SERVICE_URL", local: "http://localhost:3002" },
];

/** URL base del servicio: la de Render si esta configurada; si no, la de docker compose. */
export function serviceUrl(key: ServiceKey): string {
  const s = SERVICES.find((x) => x.key === key)!;
  return (process.env[s.env] || s.local).replace(/\/+$/, "");
}

export function isConfigured(): boolean {
  return SERVICES.every((s) => Boolean(process.env[s.env]));
}

/** GET con timeout. Devuelve null si el servicio no responde o responde con error. */
export async function getJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);
export const utcDay = (iso: string) => DAYS[new Date(iso).getUTCDay()];
