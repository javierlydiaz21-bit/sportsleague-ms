"use client";

import Link from "next/link";
import { Check, Icon, Pitch } from "@/components/icons";
import { MatchTile } from "@/components/match-row";
import ServiceStatus from "@/components/service-status";
import { Card, LoginRequired, Notice, Page } from "@/components/ui";
import { seasonMatches } from "@/lib/server-data";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { SPORT_LABEL, longDate, utcDate } from "@/lib/services";
import { api, useSession } from "@/lib/session";
import { useApi, useLoad } from "@/lib/use-api";
import type { League, Match, Referee, Team } from "@/lib/types";
import DemoData from "./demo-data";
import { defaultSeasonId, today } from "./shared";

const STEPS: SectionId[] = ["ligas", "equipos", "arbitros", "calendario"];
// Tarjetas del Inicio: las 6 secciones del panel (el sitio público queda en la barra superior)
const PANEL = SECTIONS.filter((s) => s.id !== "publico");

/** Equipos, árbitros y partidos de todas las ligas, para el avance y las cifras de cada sección. */
async function loadOverview(leagues: League[]) {
  const categories = leagues.flatMap((l) => l.categories);
  const seasons = leagues.flatMap((l) => l.seasons);
  const [teamLists, referees, fixtures] = await Promise.all([
    Promise.all(categories.map((c) => api<Team[]>("GET", `/teams?categoryId=${c.id}`).catch(() => [] as Team[]))),
    api<Referee[]>("GET", "/referees").catch(() => [] as Referee[]),
    Promise.all(seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[]))),
  ]);
  const teams = teamLists.flat();
  const matches = fixtures.flat();
  // Jornada destacada: la temporada con un partido en vivo, o la que se está jugando
  const liveSeason = matches.find((m) => m.status === "en_curso")?.seasonId;
  const featured = liveSeason ?? (matches.length ? defaultSeasonId(seasons, matches) : null);
  const views = featured ? await seasonMatches(featured) : null;
  return {
    teamsByCategory: new Map(categories.map((c, i) => [c.id, teamLists[i]])),
    teams,
    players: teams.reduce((n, t) => n + (t.players?.length ?? 0), 0),
    referees,
    matches,
    featured: featured ? { season: seasons.find((s) => s.id === featured)!, matches: views ?? [] } : null,
    names: new Map(teams.map((t) => [t.id, t.name])),
  };
}

export default function OrganizerHome() {
  const { user, ready } = useSession();
  const isOrganizer = user?.role === "organizador";
  const leagues = useApi<League[]>(isOrganizer ? "/leagues" : null);
  const key = leagues.data?.map((l) => `${l.id}.${l.seasons.length}.${l.categories.length}`).join(",") ?? null;
  const overview = useLoad(key === null ? null : `overview:${key}`, () => loadOverview(leagues.data!));

  if (!ready) return null;
  if (!isOrganizer) return <LoginRequired role="organizadores" />;

  const list = leagues.data ?? [];
  const o = overview.data;
  const categories = list.flatMap((l) => l.categories);
  const seasons = list.flatMap((l) => l.seasons);
  const done: Record<string, boolean> = {
    ligas: seasons.length > 0 && categories.some((c) => c.rule),
    equipos: Boolean(o && [...o.teamsByCategory.values()].some((t) => t.length >= 2)),
    arbitros: Boolean(o && o.referees.length > 0),
    calendario: Boolean(o && o.matches.length > 0),
  };
  const count = STEPS.filter((s) => done[s]).length;
  const next = STEPS.find((s) => !done[s]);
  const settingUp = Boolean(o) && count < STEPS.length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const stat = (id: SectionId) => {
    if (id === "ligas") return `${plural(seasons.length, "temporada", "temporadas")}, ${plural(categories.length, "categoría", "categorías")}`;
    if (!o) return "...";
    const live = o.matches.filter((m) => m.status === "en_curso").length;
    const fin = o.matches.filter((m) => m.status === "finalizado").length;
    switch (id) {
      case "equipos":
        return `${plural(o.teams.length, "equipo", "equipos")}, ${plural(o.players, "jugador", "jugadores")}`;
      case "arbitros":
        return plural(o.referees.length, "árbitro", "árbitros");
      case "calendario":
        return o.matches.length ? plural(o.matches.length, "partido", "partidos") : "Sin calendario";
      case "partidos":
        return live ? `${live} en curso, ${plural(fin, "finalizado", "finalizados")}` : plural(fin, "finalizado", "finalizados");
      case "estadisticas":
        return fin ? "Al día con el último partido" : "Aún sin partidos jugados";
    }
  };

  const reloadAll = () => {
    leagues.reload();
    overview.reload();
  };
  const first = user.name.trim().split(/\s+/)[0];
  const intro =
    list.length === 1
      ? `${list[0].name}, ${(SPORT_LABEL[list[0].sport] ?? list[0].sport).toLowerCase()}.`
      : list.length > 1
        ? `${list.length} ligas en SportsLeague.`
        : "Todavía no tienes ligas.";

  // Jornada destacada (la de hoy o la próxima de la temporada en juego)
  const f = o?.featured;
  const fDates = f ? [...new Set(f.matches.map((m) => utcDate(m.scheduledAt)))].sort() : [];
  const fDate = fDates.find((d) => d >= today()) ?? fDates.at(-1);
  const fMatches = f && fDate ? f.matches.filter((m) => utcDate(m.scheduledAt) === fDate).sort((a, b) => a.id - b.id) : [];
  const fLeague = f ? list.find((l) => l.id === f.season.leagueId) : undefined;

  return (
    <>
      <section className="hello">
        <Pitch />
        <div className="wrap">
          <div>
            <h1>Hola, {first}</h1>
            <p>
              {intro}
              {settingUp && " En cuatro pasos tu liga queda lista para jugar."}
            </p>
          </div>
          {settingUp && (
            <div className="progress" role="img" aria-label={`${count} de ${STEPS.length} pasos listos`}>
              <div className="progress-bar">
                {STEPS.map((s) => (
                  <span key={s} className={done[s] ? "on" : ""} />
                ))}
              </div>
              <p>
                <b>
                  {count} de {STEPS.length}
                </b>{" "}
                pasos para poner en marcha tu liga
              </p>
            </div>
          )}
        </div>
      </section>
      <Page>
        {leagues.error && <Notice tone="error">{leagues.error}</Notice>}
        <section aria-labelledby="secciones">
          <div className="squad-title">
            <h2 id="secciones">Secciones</h2>
            <p>Todo lo de tus ligas, en un solo lugar.</p>
          </div>
          <div className="kits">
            {PANEL.map((s, i) => (
              <Link
                key={s.id}
                className="kit"
                href={s.href}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="kit-top">
                  <span className="kit-icon">
                    <Icon id={s.id} />
                  </span>
                  {settingUp && STEPS.includes(s.id) &&
                    (done[s.id] ? (
                      <span className="badge done">
                        <Check />
                        Listo
                      </span>
                    ) : (
                      s.id === next && <span className="badge next">Siguiente paso</span>
                    ))}
                </span>
                <span className="kit-name">{s.label}</span>
                <span className="kit-desc">{s.desc}</span>
                <span className="kit-stat">{stat(s.id)}</span>
              </Link>
            ))}
          </div>
        </section>

        {f && fDate && fMatches.length > 0 && (
          <Card
            title={`Jornada ${fDates.indexOf(fDate) + 1} de ${fDates.length}`}
            hint={`${fLeague?.name ?? "Temporada"} ${f.season.year}, ${fDate === today() ? "hoy, " : ""}${longDate(fDate)}`}
            actions={<Link href={`/temporadas/${f.season.id}`}>Ver en el sitio público</Link>}
          >
            <div className="tiles">
              {fMatches.map((m) => (
                <MatchTile
                  key={m.id}
                  match={m}
                  home={o?.names.get(m.homeTeam) ?? `Equipo ${m.homeTeam}`}
                  away={o?.names.get(m.awayTeam) ?? `Equipo ${m.awayTeam}`}
                />
              ))}
            </div>
          </Card>
        )}

        <ServiceStatus />
        <DemoData onDone={reloadAll} />
      </Page>
    </>
  );
}
