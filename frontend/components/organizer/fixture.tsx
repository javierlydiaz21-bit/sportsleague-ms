"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, Section } from "@/components/ui";
import { utcDate, utcDay } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Match, Team } from "@/lib/types";
import { ActionMessage, SubTitle, flatten, today } from "./shared";

export default function Fixture({ leagues, onChange }: { leagues: League[]; onChange: () => void }) {
  const { seasons } = flatten(leagues);
  const [seasonId, setSeasonId] = useState("");
  const season = seasons.find((s) => String(s.id) === seasonId);
  const categories = season?.league.categories ?? [];
  const [categoryId, setCategoryId] = useState("");
  const category = categories.find((c) => String(c.id) === categoryId) ?? categories[0];
  const teams = useApi<Team[]>(category ? `/teams?categoryId=${category.id}` : null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [zone, setZone] = useState("monteria-norte");
  const [venues, setVenues] = useState("Cancha Municipal 1, Cancha Municipal 2");
  const [startDate, setStartDate] = useState(today());
  const [daysBetween, setDaysBetween] = useState("7");
  const [restDays, setRestDays] = useState("3");
  const [generated, setGenerated] = useState<number | null>(null);
  const matches = useApi<Match[]>(seasonId ? `/fixtures/${seasonId}` : null);
  const [matchId, setMatchId] = useState("");
  const [venue, setVenue] = useState("");
  const { busy, message, run } = useAction();

  const selectedTeams = (teams.data ?? []).filter((t) => !excluded.includes(t.id));

  return (
    <Section
      id="calendario"
      title="Calendario"
      description="Fixture Service: consulta el reglamento (League) y los equipos (Team), genera los partidos y publica fixture.published por jornada."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(async () => {
            if (!category) throw new Error("La liga de esta temporada no tiene categorías.");
            const r = await api<{ totalMatches: number; totalJornadas: number }>(
              "POST",
              `/seasons/${seasonId}/fixtures/generate`,
              {
                categoryId: category.id,
                zone,
                teamIds: selectedTeams.map((t) => t.id),
                venues: venues.split(",").map((v) => v.trim()).filter(Boolean),
                startDate,
                daysBetweenRounds: Number(daysBetween),
                restDaysMin: Number(restDays),
              },
            );
            setGenerated(Number(seasonId));
            return `${r.totalMatches} partidos en ${r.totalJornadas} jornadas. Los árbitros se asignan solos por el evento fixture.published.`;
          });
          if (ok) {
            matches.reload();
            onChange();
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Temporada">
            <select
              className="field"
              required
              value={seasonId}
              onChange={(e) => {
                setSeasonId(e.target.value);
                setCategoryId("");
                setExcluded([]);
              }}
            >
              <option value="">Elige una temporada</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.league.name} {s.year} (#{s.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select className="field" value={category?.id ?? ""} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zona de las sedes" hint="Para asignar árbitros de la zona">
            <input className="field" required value={zone} onChange={(e) => setZone(e.target.value)} />
          </Field>
          <Field label="Primera jornada" hint={`Cae ${utcDay(startDate)}`}>
            <input className="field" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Canchas disponibles" hint="Separadas por coma">
              <input className="field" required value={venues} onChange={(e) => setVenues(e.target.value)} />
            </Field>
          </div>
          <Field label="Días entre jornadas">
            <input className="field" type="number" min={1} value={daysBetween} onChange={(e) => setDaysBetween(e.target.value)} />
          </Field>
          <Field label="Descanso mínimo (días)">
            <input className="field" type="number" min={1} value={restDays} onChange={(e) => setRestDays(e.target.value)} />
          </Field>
        </div>
        {season && (
          <fieldset className="mt-3">
            <legend className="text-sm text-muted">Equipos participantes</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {(teams.data ?? []).map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!excluded.includes(t.id)}
                    onChange={() =>
                      setExcluded(excluded.includes(t.id) ? excluded.filter((x) => x !== t.id) : [...excluded, t.id])
                    }
                  />
                  {t.name}
                </label>
              ))}
              {teams.data?.length === 0 && <span className="text-muted">La categoría no tiene equipos.</span>}
            </div>
          </fieldset>
        )}
        <button className="btn btn-primary mt-3" disabled={busy || !seasonId}>
          Generar calendario
        </button>
      </form>
      <ActionMessage message={message} />
      {generated && (
        <p className="mt-2 text-sm">
          <Link href={`/temporadas/${generated}`} className="font-semibold text-sync hover:underline">
            Ver el calendario publicado
          </Link>
        </p>
      )}

      {seasonId && matches.data && matches.data.length > 0 && (
        <>
          <SubTitle>Cambiar la sede de un partido</SubTitle>
          <p className="text-sm text-muted">Publica fixture.venue_changed: el Notification Service avisa a los equipos.</p>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(async () => {
                  const m = await api<Match>("PUT", `/matches/${matchId}/venue`, { venue });
                  return `El partido #${m.id} ahora se juega en ${m.venue}.`;
                })
              )
                matches.reload();
            }}
          >
            <Field label="Partido">
              <select className="field" required value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                <option value="">Elige</option>
                {matches.data.map((m) => {
                  const name = (id: number) => teams.data?.find((t) => t.id === id)?.name ?? `Equipo ${id}`;
                  return (
                    <option key={m.id} value={m.id}>
                      {utcDate(m.scheduledAt)}: {name(m.homeTeam)} vs {name(m.awayTeam)} ({m.venue})
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Nueva sede">
              <input className="field" required value={venue} onChange={(e) => setVenue(e.target.value)} />
            </Field>
            <button className="btn btn-ghost" disabled={busy}>
              Cambiar sede
            </button>
          </form>

          <SubTitle>Recalcular posiciones</SubTitle>
          <p className="text-sm text-muted">
            El Statistics Service recalcula solo al llegar cada acta. Úsalo si el League Service no respondió en ese
            momento: es idempotente.
          </p>
          <button
            className="btn btn-ghost mt-2"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api<{ matches: number; teams: number }>("POST", `/standings/${seasonId}/recalculate`);
                return `Temporada recalculada: ${r.matches} acta(s), ${r.teams} equipo(s).`;
              })
            }
          >
            Recalcular la temporada
          </button>
        </>
      )}
    </Section>
  );
}
