"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";
import { ApiError, api } from "@/lib/session";
import type { Category, League, Referee, Season, Team } from "@/lib/types";
import { DAYS, addDays, today } from "./shared";

const TEAMS = ["Halcones FC", "Tigres United", "Leones del Sur", "Águilas Doradas"];
const NAMES = [
  ["Juan Pérez", "Carlos Díaz", "Andrés López", "Mateo Ruiz", "Samuel Torres"],
  ["Luis Gómez", "Diego Herrera", "Santiago Vargas", "Daniel Castro", "Felipe Rojas"],
  ["Miguel Ortiz", "Sebastián Mora", "Nicolás Peña", "Tomás Ríos", "Emilio Salas"],
  ["David Romero", "Julián Cruz", "Martín Vega", "Gabriel Soto", "Óscar Medina"],
];

/** Fecha de nacimiento de alguien que hoy tiene `years` anios. */
function bornYearsAgo(years: number, offsetDays: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 30 - offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Crea una liga completa recorriendo los microservicios en el mismo orden que un
 * organizador: League, Team, Referee (y sus cuentas en el gateway) y Fixture. La
 * primera jornada queda para hoy, asi se puede jugar en vivo de inmediato.
 */
export default function DemoData({ onDone }: { onDone: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function createAccount(name: string, email: string, refereeId: number, suffix: string) {
    try {
      await api("POST", "/auth/users", { name, email, password: "arbitro123", role: "arbitro", refereeId });
      return email;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) throw err;
      const alt = email.replace("@", `.${suffix}@`);
      await api("POST", "/auth/users", { name, email: alt, password: "arbitro123", role: "arbitro", refereeId });
      return alt;
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    setSeasonId(null);
    const lines: string[] = [];
    const step = (text: string) => {
      lines.push(text);
      setLog([...lines]);
    };
    try {
      const start = today();
      const league = await api<League>("POST", "/leagues", { name: "Liga Municipal de Montería", sport: "futbol" });
      const season = await api<Season>("POST", `/leagues/${league.id}/seasons`, {
        year: Number(start.slice(0, 4)),
        startDate: start,
        endDate: addDays(start, 150),
      });
      const category = await api<Category>("POST", `/seasons/${season.id}/categories`, { name: "Sub-17", ageRange: "15-17" });
      await api("PUT", `/categories/${category.id}/rules`, { pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: "diferencia_de_goles" });
      step(`League Service: liga #${league.id}, temporada ${season.year} (#${season.id}), categoría Sub-17 con reglamento 3-1-0.`);

      const teams: Team[] = [];
      for (const [i, name] of TEAMS.entries()) {
        const team = await api<Team>("POST", "/teams", { name, categoryId: category.id });
        for (const [j, player] of NAMES[i].entries()) {
          await api("POST", `/teams/${team.id}/players`, {
            name: player,
            birthDate: bornYearsAgo(15 + (j % 3), i * 10 + j),
            jerseyNumber: [1, 4, 7, 9, 10][j],
          });
        }
        teams.push(team);
      }
      step(`Team Service: ${teams.length} equipos con 5 jugadores cada uno (elegibilidad validada con el League Service).`);

      const accounts: string[] = [];
      for (const n of [1, 2]) {
        const referee = await api<Referee>("POST", "/referees", {
          zone: "monteria-norte",
          categoriesCertified: [category.id],
          availability: DAYS,
        });
        accounts.push(await createAccount(`Árbitro ${n}`, `arbitro${n}@sportsleague.co`, referee.id, `liga${league.id}`));
      }
      step(`Referee Service: 2 árbitros de monteria-norte. Cuentas: ${accounts.join(", ")} (contraseña arbitro123).`);

      const fixture = await api<{ totalMatches: number; totalJornadas: number }>(
        "POST",
        `/seasons/${season.id}/fixtures/generate`,
        {
          categoryId: category.id,
          zone: "monteria-norte",
          teamIds: teams.map((t) => t.id),
          venues: ["Cancha Municipal 1", "Cancha Municipal 2"],
          startDate: start,
        },
      );
      step(
        `Fixture Service: ${fixture.totalMatches} partidos en ${fixture.totalJornadas} jornadas, la primera hoy. ` +
          `Publicó fixture.published: el Referee Service asigna árbitros y el Notification Service avisa los horarios.`,
      );
      setSeasonId(season.id);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      id="demo"
      title="Datos de ejemplo"
      hint="Crea en un paso una liga lista para jugar: temporada, categoría, 4 equipos con jugadores, 2 árbitros con cuenta y el calendario. Después abre un partido de la jornada de hoy y registra goles."
      actions={
        <button type="button" className="btn btn-green" onClick={run} disabled={busy}>
          {busy ? "Creando..." : "Cargar liga de ejemplo"}
        </button>
      }
    >
      {log.length > 0 && (
        <ol className="log" aria-live="polite">
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )}
      {error && <p className="form-msg is-error">No se pudo completar: {error}</p>}
      {seasonId && (
        <p className="mt-3">
          <Link href={`/temporadas/${seasonId}`} className="linkish">
            Ver el calendario y la tabla de la temporada
          </Link>
        </p>
      )}
    </Card>
  );
}
