"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import Crest from "@/components/crest";
import { Card, EmptyCard, Field, FormMessage, Notice, StatusChip } from "@/components/ui";
import { cap, longDate, utcDate, utcDay } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { Category, League, Match, Season, Team } from "@/lib/types";
import OrganizerSection from "./panel";
import { SeasonPicker, defaultSeasonId, flatten, useAllMatches, useAssignments } from "./shared";

export default function FixtureSection() {
  return <OrganizerSection id="calendario">{(ctx) => <Fixture {...ctx} />}</OrganizerSection>;
}

function Fixture({ leagues, reload }: { leagues: League[]; reload: () => void }) {
  const { seasons } = flatten(leagues);
  const all = useAllMatches(leagues);
  const [choice, setChoice] = useState<number | null>(null);
  const [published, setPublished] = useState("");

  if (!seasons.length) {
    return (
      <EmptyCard
        title="Todavía no hay temporadas"
        text="Crea una temporada en Ligas y reglamento para generar su calendario."
        href="/organizador/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  if (!all.data) return <p className="empty">{all.error || "Cargando el calendario..."}</p>;

  const seasonId = choice ?? defaultSeasonId(seasons, all.data.matches)!;
  const season = seasons.find((s) => s.id === seasonId)!;
  const matches = all.data.matches
    .filter((m) => m.seasonId === seasonId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);

  return (
    <>
      <div className="toolbar">
        <SeasonPicker
          seasons={seasons}
          value={seasonId}
          onChange={(id) => {
            setChoice(id);
            setPublished("");
          }}
        />
      </div>
      {published && <Notice tone="ok">{published}</Notice>}
      {matches.length > 0 ? (
        <Rounds season={season} matches={matches} names={all.data.names} onChange={all.reload} />
      ) : (
        <Generator
          key={seasonId}
          season={season}
          categories={season.league.categories}
          onDone={(text) => {
            setPublished(text);
            all.reload();
            reload();
          }}
        />
      )}
    </>
  );
}

/** Calendario publicado, por jornadas, con el cambio de sede en cada partido programado. */
function Rounds({
  season,
  matches,
  names,
  onChange,
}: {
  season: Season & { league: League };
  matches: Match[];
  names: Map<number, string>;
  onChange: () => void;
}) {
  const assignments = useAssignments();
  const [editing, setEditing] = useState<number | null>(null);
  const venue = useAction();
  const recalc = useAction();
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const dates = [...new Set(matches.map((m) => utcDate(m.scheduledAt)))];

  return (
    <>
      <Card
        title={`Temporada ${season.year}, ${season.league.name}`}
        hint="Solo se puede cambiar la sede de partidos programados. El cambio se avisa a los equipos (fixture.venue_changed)."
        actions={<Link href={`/temporadas/${season.id}?tab=calendario`}>Ver en el sitio público</Link>}
      >
        <FormMessage message={venue.message} />
        {dates.map((d, i) => (
          <Fragment key={d}>
            <div className="round-head">
              <h3>Jornada {i + 1}</h3>
              <p>{cap(longDate(d))}</p>
            </div>
            <div className="scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Partido</th>
                    <th>Cancha</th>
                    <th>Estado</th>
                    <th className="hide-sm">Árbitro</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .filter((m) => utcDate(m.scheduledAt) === d)
                    .map((m) => {
                      const a = assignments.data?.byMatch.get(m.id);
                      return (
                        <tr key={m.id}>
                          <td>
                            <span className="team-cell">
                              <Crest name={name(m.homeTeam)} size={24} />
                              {name(m.homeTeam)}
                            </span>
                            <span className="team-cell">
                              <Crest name={name(m.awayTeam)} size={24} />
                              {name(m.awayTeam)}
                            </span>
                          </td>
                          <td>
                            {editing === m.id ? (
                              <form
                                className="inline-form"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const next = String(new FormData(e.currentTarget).get("venue") ?? "").trim();
                                  const ok = await venue.run(async () => {
                                    if (!next) throw new Error("Escribe el nombre de la cancha.");
                                    if (next === m.venue) throw new Error("Esa ya es la cancha del partido.");
                                    const r = await api<Match>("PUT", `/matches/${m.id}/venue`, { venue: next });
                                    return `Sede cambiada y aviso enviado: ${name(m.homeTeam)} contra ${name(m.awayTeam)} ahora se juega en ${r.venue}.`;
                                  });
                                  if (ok) {
                                    setEditing(null);
                                    onChange();
                                  }
                                }}
                              >
                                <input name="venue" defaultValue={m.venue} aria-label="Nueva cancha" autoFocus />
                                <button className="btn btn-blue btn-sm" disabled={venue.busy}>
                                  Guardar
                                </button>
                                <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                                  Cancelar
                                </button>
                              </form>
                            ) : (
                              m.venue
                            )}
                          </td>
                          <td>
                            <StatusChip status={m.status} />
                          </td>
                          <td className="hide-sm">
                            {a ? `#${a.refereeId}, ${a.confirmed ? "confirmado" : "sin confirmar"}` : assignments.data ? "Sin árbitro" : ""}
                          </td>
                          <td>
                            {m.status === "programado" && editing !== m.id && (
                              <button type="button" className="linkish" onClick={() => setEditing(m.id)}>
                                Cambiar sede
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Fragment>
        ))}
      </Card>

      <Card
        title="Recalcular posiciones"
        hint="El Statistics Service recalcula solo al llegar cada acta. Úsalo si el League Service no respondió en ese momento: es idempotente."
      >
        <div className="factions">
          <button
            type="button"
            className="btn"
            disabled={recalc.busy}
            onClick={() =>
              recalc.run(async () => {
                const r = await api<{ matches: number; teams: number }>("POST", `/standings/${season.id}/recalculate`);
                return `Temporada recalculada: ${r.matches} acta(s), ${r.teams} equipo(s).`;
              })
            }
          >
            Recalcular la temporada
          </button>
        </div>
        <FormMessage message={recalc.message} />
      </Card>
    </>
  );
}

/** Generación del calendario: todos contra todos, publicado por jornadas (fixture.published). */
function Generator({
  season,
  categories,
  onDone,
}: {
  season: Season & { league: League };
  categories: Category[];
  onDone: (message: string) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0] ? String(categories[0].id) : "");
  const category = categories.find((c) => String(c.id) === categoryId);
  const teams = useApi<Team[]>(category ? `/teams?categoryId=${category.id}` : null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [zone, setZone] = useState("monteria-norte");
  const [venues, setVenues] = useState("Cancha Municipal 1, Cancha Municipal 2");
  const [startDate, setStartDate] = useState(utcDate(season.startDate));
  const [daysBetween, setDaysBetween] = useState("7");
  const [restDays, setRestDays] = useState("3");
  const { busy, message, run } = useAction();
  const selected = (teams.data ?? []).filter((t) => !excluded.includes(t.id));

  if (!categories.length) {
    return (
      <EmptyCard
        title={`La liga ${season.league.name} no tiene categorías`}
        text="El calendario se genera para una categoría con su reglamento. Créala en Ligas y reglamento."
        href="/organizador/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }

  return (
    <Card
      title={`Generar el calendario de ${season.year}`}
      hint="Todos contra todos, sin repetir cancha en una jornada, con el descanso mínimo y la localía equilibrada. Al publicarlo, los árbitros se asignan solos y los equipos reciben sus horarios."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          let text = "";
          const ok = await run(async () => {
            if (!category?.rule) throw new Error(`La categoría ${category?.name} no tiene reglamento. Defínelo en Ligas y reglamento.`);
            if (selected.length < 2) throw new Error("Elige al menos 2 equipos.");
            if (Number(daysBetween) < Number(restDays))
              throw new Error(`Las jornadas quedarían cada ${daysBetween} días y el descanso mínimo es de ${restDays}. Aumenta los días entre jornadas.`);
            const r = await api<{ totalMatches: number; totalJornadas: number }>("POST", `/seasons/${season.id}/fixtures/generate`, {
              categoryId: category.id,
              zone,
              teamIds: selected.map((t) => t.id),
              venues: venues
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              startDate,
              daysBetweenRounds: Number(daysBetween),
              restDaysMin: Number(restDays),
            });
            text = `Calendario publicado: ${r.totalMatches} partidos en ${r.totalJornadas} jornadas. Los árbitros se asignan solos por el evento fixture.published.`;
            return text;
          });
          if (ok) onDone(text);
        }}
      >
        <div className="fgrid">
          <Field label="Categoría">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setExcluded([]);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zona" hint="para asignar árbitros">
            <input required value={zone} onChange={(e) => setZone(e.target.value)} />
          </Field>
          <Field label="Primera jornada" hint={`cae ${utcDay(startDate)}`}>
            <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Descanso mínimo" hint="días">
            <input type="number" min={1} required value={restDays} onChange={(e) => setRestDays(e.target.value)} />
          </Field>
          <Field label="Días entre jornadas">
            <input type="number" min={1} required value={daysBetween} onChange={(e) => setDaysBetween(e.target.value)} />
          </Field>
          <Field label="Canchas disponibles" hint="separadas por coma" className="full">
            <input required value={venues} onChange={(e) => setVenues(e.target.value)} />
          </Field>
          <fieldset className="checks">
            <legend>Equipos de {category?.name}</legend>
            {(teams.data ?? []).map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={!excluded.includes(t.id)}
                  onChange={() => setExcluded(excluded.includes(t.id) ? excluded.filter((x) => x !== t.id) : [...excluded, t.id])}
                />
                {t.name}
              </label>
            ))}
            {teams.data?.length === 0 && <span className="empty">Esta categoría no tiene equipos.</span>}
          </fieldset>
        </div>
        <div className="factions">
          <button className="btn btn-green" disabled={busy}>
            {busy ? "Publicando..." : "Generar y publicar calendario"}
          </button>
        </div>
        <FormMessage message={message} />
      </form>
    </Card>
  );
}
