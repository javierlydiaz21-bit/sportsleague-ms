"use client";

import type { League } from "@/lib/types";

export const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const DAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Temporadas y categorias de todas las ligas, para los selectores. */
export function flatten(leagues: League[]) {
  return {
    seasons: leagues.flatMap((l) => l.seasons.map((s) => ({ ...s, league: l }))),
    categories: leagues.flatMap((l) => l.categories.map((c) => ({ ...c, league: l }))),
  };
}

export function ActionMessage({ message }: { message: { tone: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-ok" : "text-error"}`}>
      {message.text}
    </p>
  );
}

export function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 font-display text-lg font-bold first:mt-0">{children}</h3>;
}
