"use client";

/*
 * 4. Calendario (diseño: viewCalendario, ruta #/calendario). Por el API Gateway:
 *   Fixture Service .. GET  /fixtures/{seasonId}                  calendario de la temporada
 *                      POST /seasons/{id}/fixtures/generate       publicar el calendario (fixture.published por jornada)
 *                      PUT  /matches/{id}/venue                   cambiar la sede (fixture.venue_changed: Notification avisa)
 *   Team Service ..... GET  /teams?categoryId={id}                equipos de cada categoría
 *   Referee Service .. GET  /referees, GET /referees/{id}/assignments   árbitro asignado a cada partido
 *   Statistics ....... POST /standings/{seasonId}/recalculate     recalcular posiciones (fuera del diseño)
 * El calendario propuesto se arma aquí con el mismo algoritmo del Fixture Service
 * (fixture-service/src/fixtures/fixture-generator.util.ts), así lo que se revisa es lo que se publica.
 */

import { Fragment, useState } from "react";
import Crest from "@/components/crest";
import { useLeague } from "@/components/league-context";
import { EmptyCard, FormMessage, Notice, StatusChip } from "@/components/ui";
import { cap, longDate, utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useLoad } from "@/lib/use-api";
import type { Assignment, Category, League, Match, Referee, Season, Team } from "@/lib/types";
import { PanelSection } from "./panel";
import { today } from "./shared";

export default function FixtureSection() {
  return (
    <PanelSection id="calendario" intro="Cada temporada tiene un calendario. Al publicarlo, cada jornada se envía a los árbitros y a los equipos.">
      <Fixture />
    </PanelSection>
  );
}

interface Proposed {
  round: number;
  home: number;
  away: number;
  venue: string;
  date: string;
}

/** Todos contra todos por el método del círculo, igual que el Fixture Service. */
function roundRobin(ids: number[], venues: string[], startISO: string, daysBetween: number): Proposed[] {
  const BYE = -1;
  const rot = ids.length % 2 === 0 ? [...ids] : [...ids, BYE];
  const n = rot.length;
  const home = new Map(ids.map((t) => [t, 0]));
  const out: Proposed[] = [];
  let cur = [...rot];
  for (let r = 0; r < n - 1; r++) {
    const d = new Date(`${startISO}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + r * daysBetween);
    let v = r;
    for (let i = 0; i < n / 2; i++) {
      const a = cur[i];
      const b = cur[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      const bHome = home.get(b)! < home.get(a)! || (home.get(b) === home.get(a) && r % 2 === 1);
      const h = bHome ? b : a;
      const w = bHome ? a : b;
      home.set(h, home.get(h)! + 1);
      out.push({ round: r + 1, home: h, away: w, venue: venues[v++ % venues.length], date: d.toISOString() });
    }
    cur = [cur[0], cur[n - 1], ...cur.slice(1, n - 1)];
  }
  return out;
}

interface GenParams {
  categoryId: number;
  zone: string;
  teamIds: number[];
  venues: string;
  startDate: string;
  restDaysMin: number;
  daysBetweenRounds: number;
}

/** Validaciones del diseño antes de proponer el calendario. */
function buildFixture(p: GenParams, cats: Category[]) {
  const venues = p.venues
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const c = cats.find((x) => x.id === p.categoryId);
  if (!c) return { error: "Elige una categoría." };
  if (!c.rule) return { error: `La categoría ${c.name} no tiene reglamento. Defínelo en Ligas y reglamento antes de generar el calendario.` };
  if (p.teamIds.length < 2) return { error: "Elige al menos 2 equipos." };
  if (!p.zone) return { error: "Escribe la zona de las canchas. Con ella se asignan los árbitros." };
  if (!venues.length) return { error: "Escribe al menos una cancha." };
  if (!p.startDate) return { error: "Elige la fecha de la primera jornada." };
  if (!(p.restDaysMin >= 1) || !(p.daysBetweenRounds >= 1)) return { error: "El descanso mínimo y los días entre jornadas deben ser 1 o más." };
  if (p.daysBetweenRounds < p.restDaysMin) {
    return {
      error: `Las jornadas quedarían cada ${p.daysBetweenRounds} días y el descanso mínimo es de ${p.restDaysMin}. Aumenta los días entre jornadas.`,
    };
  }
  const per = Math.floor(p.teamIds.length / 2);
  if (per > venues.length) {
    return {
      error: `Cada jornada tiene ${per} partidos y solo hay ${venues.length} ${venues.length === 1 ? "cancha" : "canchas"}. Agrega canchas para que ningún partido se cruce.`,
    };
  }
  const list = roundRobin(p.teamIds, venues, p.startDate, p.daysBetweenRounds);
  return { list, venues, rounds: Math.max(...list.map((x) => x.round)) };
}

/** Árbitro asignado a cada partido (Referee Service). */
async function loadAssignments() {
  const referees = await api<Referee[]>("GET", "/referees").catch(() => [] as Referee[]);
  const lists = await Promise.all(referees.map((r) => api<Assignment[]>("GET", `/referees/${r.id}/assignments`).catch(() => [] as Assignment[])));
  return new Map(lists.flat().map((a) => [a.matchId, a]));
}

/** Partidos de cada temporada, equipos de la liga y asignaciones. */
async function loadCalendar(league: League) {
  const [fixtures, teamLists, assignments] = await Promise.all([
    Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[]))),
    Promise.all(league.categories.map((c) => api<Team[]>("GET", `/teams?categoryId=${c.id}`).catch(() => [] as Team[]))),
    loadAssignments(),
  ]);
  return {
    matches: new Map(league.seasons.map((s, i) => [s.id, fixtures[i]])),
    teams: teamLists.flat(),
    assignments,
  };
}

/** Temporada que se muestra al entrar: la que se está jugando, si no la última con calendario. */
function defaultSeason(seasons: Season[], matches: Map<number, Match[]>) {
  if (!seasons.length) return null;
  const t = today();
  const withMatches = seasons.filter((s) => matches.get(s.id)?.length);
  const current = withMatches.find((s) => utcDate(s.startDate) <= t && t <= utcDate(s.endDate));
  return (current ?? withMatches.at(-1) ?? seasons.at(-1))!.id;
}

function Fixture() {
  const { leagues, league } = useLeague();
  const seasons = [...(league?.seasons ?? [])].sort((a, b) => a.year - b.year || a.id - b.id);
  const data = useLoad(league ? `calendario:${league.id}:${seasons.length}:${league.categories.length}` : null, () => loadCalendar(league!));
  const [choice, setChoice] = useState<{ league: number; season: number } | null>(null);
  const [flash, setFlash] = useState("");

  if (!leagues) return <p className="empty">Cargando...</p>;
  if (!league || !seasons.length) {
    return (
      <EmptyCard
        title="Todavía no hay temporadas"
        text="Crea una temporada en Ligas y reglamento para generar su calendario."
        href="/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  if (!data.data) return <p className="empty">{data.error || "Cargando el calendario..."}</p>;

  const sid = choice?.league === league.id ? choice.season : defaultSeason(seasons, data.data.matches)!;
  const season = seasons.find((s) => s.id === sid)!;
  const matches = [...(data.data.matches.get(sid) ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  const tools = (
    <div className="toolbar">
      <label className="fl">
        Temporada
        <select
          value={sid}
          onChange={(e) => {
            setChoice({ league: league.id, season: Number(e.target.value) });
            setFlash("");
          }}
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.year}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  const top = flash && <Notice tone="ok">{flash}</Notice>;

  if (matches.length) {
    return (
      <>
        {top}
        {tools}
        <Rounds
          league={league}
          season={season}
          matches={matches}
          teams={data.data.teams}
          assignments={data.data.assignments}
          onVenue={(text) => {
            setFlash(text);
            data.reload();
          }}
        />
        <Recalculate season={season} />
      </>
    );
  }

  const genCategories = league.categories.filter((c) => data.data!.teams.filter((t) => t.categoryId === c.id).length >= 2);
  if (!genCategories.length) {
    return (
      <>
        {top}
        {tools}
        <EmptyCard
          title="Necesitas al menos dos equipos en una categoría"
          text="Registra los equipos para poder generar el calendario."
          href="/equipos"
          label="Ir a Equipos"
        />
      </>
    );
  }
  return (
    <>
      {top}
      {tools}
      <Generator
        key={sid}
        league={league}
        season={season}
        teams={data.data.teams}
        firstCategory={genCategories[0]}
        onPublished={(text) => {
          setFlash(text);
          data.reload();
        }}
      />
    </>
  );
}

/** Calendario publicado, por jornadas, con el cambio de sede de los partidos programados. */
function Rounds({
  league,
  season,
  matches,
  teams,
  assignments,
  onVenue,
}: {
  league: League;
  season: Season;
  matches: Match[];
  teams: Team[];
  assignments: Map<number, Assignment>;
  onVenue: (text: string) => void;
}) {
  const [venueEdit, setVenueEdit] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Equipo ${id}`;
  const category = league.categories.find((c) => c.id === teams.find((t) => t.id === matches[0].homeTeam)?.categoryId);
  const dates = [...new Set(matches.map((m) => utcDate(m.scheduledAt)))];

  async function saveVenue(e: React.FormEvent<HTMLFormElement>, m: Match) {
    e.preventDefault();
    const v = String(new FormData(e.currentTarget).get("venue")).trim();
    if (!v) return setMsg("Escribe el nombre de la cancha.");
    if (v === m.venue) return setMsg("Esa ya es la cancha del partido.");
    setBusy(true);
    try {
      // Fixture Service: PUT /matches/{id}/venue (publica fixture.venue_changed y el Notification Service avisa)
      await api<Match>("PUT", `/matches/${m.id}/venue`, { venue: v });
      setVenueEdit(null);
      onVenue(`Sede cambiada y aviso enviado: ${name(m.homeTeam)} contra ${name(m.awayTeam)} ahora se juega en ${v}.`);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>
        Temporada {season.year}
        {category ? `, ${category.name}` : ""}
      </h2>
      <p className="hint">Solo se puede cambiar la sede de partidos programados. El cambio se avisa a los equipos.</p>
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
                    const asg = assignments.get(m.id);
                    return (
                      <tr key={m.id}>
                        <td>
                          <span className="team-cell">
                            <Crest name={name(m.homeTeam)} id={m.homeTeam} size={24} />
                            {name(m.homeTeam)}
                          </span>
                          <span className="team-cell">
                            <Crest name={name(m.awayTeam)} id={m.awayTeam} size={24} />
                            {name(m.awayTeam)}
                          </span>
                        </td>
                        <td>
                          {venueEdit === m.id ? (
                            <form className="inline-form" noValidate onSubmit={(e) => saveVenue(e, m)}>
                              <input name="venue" defaultValue={m.venue} aria-label="Nueva cancha" autoFocus />
                              <button className="btn btn-blue btn-sm" type="submit" disabled={busy}>
                                Guardar
                              </button>
                              <button className="btn btn-sm" type="button" onClick={() => setVenueEdit(null)}>
                                Cancelar
                              </button>
                              {msg && (
                                <p className="form-msg is-error" role="alert">
                                  {msg}
                                </p>
                              )}
                            </form>
                          ) : (
                            m.venue
                          )}
                        </td>
                        <td>
                          <StatusChip status={m.status} />
                        </td>
                        <td className="hide-sm">{asg ? `#${asg.refereeId}, ${asg.confirmed ? "confirmado" : "sin confirmar"}` : "Sin árbitro"}</td>
                        <td>
                          {m.status === "programado" && venueEdit !== m.id && (
                            <button
                              className="linkish"
                              type="button"
                              onClick={() => {
                                setMsg("");
                                setVenueEdit(m.id);
                              }}
                            >
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
    </section>
  );
}

/** Generar el calendario: propuesta para revisar y luego publicarla. */
function Generator({
  league,
  season,
  teams,
  firstCategory,
  onPublished,
}: {
  league: League;
  season: Season;
  teams: Team[];
  firstCategory: Category;
  onPublished: (text: string) => void;
}) {
  const teamsOf = (catId: number) => teams.filter((t) => t.categoryId === catId);
  const [params, setParams] = useState<GenParams>({
    categoryId: firstCategory.id,
    zone: "monteria-norte",
    teamIds: teamsOf(firstCategory.id).map((t) => t.id),
    venues: "Cancha Municipal 1, Cancha Municipal 2",
    startDate: utcDate(season.startDate),
    restDaysMin: 3,
    daysBetweenRounds: 7,
  });
  const [preview, setPreview] = useState<{ list: Proposed[]; venues: string[]; rounds: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cat = league.categories.find((c) => c.id === params.categoryId)!;
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Equipo ${id}`;

  const read = (form: HTMLFormElement): GenParams => {
    const fd = new FormData(form);
    return {
      categoryId: Number(fd.get("categoryId")),
      zone: String(fd.get("zone") || "").trim(),
      teamIds: fd.getAll("teamIds").map(Number),
      venues: String(fd.get("venues") || ""),
      startDate: String(fd.get("startDate") || ""),
      restDaysMin: Number(fd.get("restDaysMin")),
      daysBetweenRounds: Number(fd.get("daysBetweenRounds")),
    };
  };

  function propose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = read(e.currentTarget);
    setParams(p);
    const res = buildFixture(p, league.categories);
    if ("error" in res) {
      setError(res.error!);
      setPreview(null);
    } else {
      setError("");
      setPreview(res);
    }
  }

  async function publish() {
    if (!preview) return;
    setBusy(true);
    try {
      // Fixture Service: POST /seasons/{id}/fixtures/generate (publica fixture.published por jornada)
      const created = await api<{ totalMatches: number; totalJornadas: number; matches?: Match[] }>(
        "POST",
        `/seasons/${season.id}/fixtures/generate`,
        {
          categoryId: params.categoryId,
          zone: params.zone,
          teamIds: params.teamIds,
          venues: preview.venues,
          startDate: params.startDate,
          restDaysMin: params.restDaysMin,
          daysBetweenRounds: params.daysBetweenRounds,
        },
      );
      // El Referee Service asigna árbitros al recibir fixture.published: se cuentan los partidos con árbitro
      await new Promise((r) => setTimeout(r, 1500));
      const [published, assignments] = await Promise.all([
        api<Match[]>("GET", `/fixtures/${season.id}`).catch(() => [] as Match[]),
        loadAssignments(),
      ]);
      const total = created.totalMatches ?? preview.list.length;
      const rounds = created.totalJornadas ?? preview.rounds;
      const assigned = published.filter((m) => assignments.has(m.id)).length;
      const missing = total - assigned;
      onPublished(
        `Calendario publicado: ${total} partidos en ${rounds} jornadas. ${
          missing
            ? `${assigned} partidos ya tienen árbitro; ${missing} quedaron sin árbitro porque no hay árbitros de esa zona y categoría disponibles ese día.`
            : "Todos los partidos ya tienen árbitro asignado."
        }`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const byRound = new Map<number, Proposed[]>();
  preview?.list.forEach((x) => byRound.set(x.round, [...(byRound.get(x.round) ?? []), x]));

  return (
    <section className="card">
      <h2>Generar el calendario de {season.year}</h2>
      <p className="hint">Todos contra todos, sin repetir cancha en una jornada, con el descanso mínimo y la localía equilibrada.</p>
      <form id="gen-form" noValidate onSubmit={propose}>
        <div className="fgrid">
          <label className="fl">
            Categoría
            <select
              name="categoryId"
              value={params.categoryId}
              onChange={(e) => {
                const form = e.currentTarget.form!;
                const id = Number(e.target.value);
                setParams({ ...read(form), categoryId: id, teamIds: teamsOf(id).map((t) => t.id) });
                setPreview(null);
                setError("");
              }}
            >
              {league.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fl">
            Zona <small>para asignar árbitros</small>
            <input name="zone" defaultValue={params.zone} />
          </label>
          <label className="fl">
            Primera jornada
            <input type="date" name="startDate" defaultValue={params.startDate} />
          </label>
          <label className="fl">
            Descanso mínimo <small>días</small>
            <input type="number" name="restDaysMin" min={1} defaultValue={params.restDaysMin} />
          </label>
          <label className="fl">
            Días entre jornadas
            <input type="number" name="daysBetweenRounds" min={1} defaultValue={params.daysBetweenRounds} />
          </label>
          <label className="fl" style={{ gridColumn: "1/-1" }}>
            Canchas disponibles <small>separadas por coma</small>
            <input name="venues" defaultValue={params.venues} />
          </label>
          <fieldset className="checks" key={params.categoryId}>
            <legend>Equipos de {cat.name}</legend>
            {teamsOf(cat.id).length ? (
              teamsOf(cat.id).map((t) => (
                <label key={t.id}>
                  <input type="checkbox" name="teamIds" value={t.id} defaultChecked={params.teamIds.includes(t.id)} />
                  {t.name}
                </label>
              ))
            ) : (
              <span className="empty">Esta categoría no tiene equipos.</span>
            )}
          </fieldset>
        </div>
        <div className="factions">
          <button className="btn btn-blue" type="submit">
            Ver calendario propuesto
          </button>
        </div>
        {error && (
          <p className="form-msg is-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {preview && (
        <div className="f">
          <p>
            <b>
              {preview.list.length} partidos en {preview.rounds} jornadas.
            </b>{" "}
            Revisa la propuesta y publícala.
          </p>
          <div className="rounds" style={{ marginTop: 14 }} tabIndex={0} aria-label="Calendario propuesto">
            {[...byRound].map(([r, ms]) => (
              <div className="round" key={r}>
                <h3>Jornada {r}</h3>
                <time>{cap(longDate(ms[0].date))}</time>
                {ms.map((x) => (
                  <div className="m" key={`${x.home}-${x.away}`}>
                    <div>
                      <Crest name={name(x.home)} id={x.home} size={22} />
                      {name(x.home)}
                    </div>
                    <div>
                      <Crest name={name(x.away)} id={x.away} size={22} />
                      {name(x.away)}
                    </div>
                    <small>{x.venue}</small>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="factions">
            <button className="btn btn-green" type="button" disabled={busy} onClick={publish}>
              Publicar calendario
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Recalcular posiciones (fuera del diseño): por si el Statistics Service no recibió un acta. */
function Recalculate({ season }: { season: Season }) {
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <h2>Recalcular posiciones</h2>
      <p className="hint">
        El Statistics Service recalcula solo al llegar cada acta. Úsalo si el League Service no respondió en ese momento: es
        idempotente.
      </p>
      <div className="factions">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              // Statistics Service: POST /standings/{seasonId}/recalculate
              const r = await api<{ matches: number; teams: number }>("POST", `/standings/${season.id}/recalculate`);
              setMsg({ tone: "ok", text: `Temporada recalculada: ${r.matches} acta(s), ${r.teams} equipo(s).` });
            } catch (err) {
              setMsg({ tone: "error", text: (err as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          Recalcular la temporada
        </button>
      </div>
      <FormMessage message={msg} />
    </section>
  );
}
