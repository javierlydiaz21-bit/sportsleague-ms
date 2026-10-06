import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import LiveBoard from "@/components/live-board";
import StandingsTable from "@/components/standings-table";
import { findSeason, formByTeam, seasonMatches, teamName, teamsById } from "@/lib/server-data";
import { getJson } from "@/lib/services";
import type { LiveMatch, Match, Standings } from "@/lib/types";

async function load(matchId: number) {
  const match = await getJson<Match>(`/matches/${matchId}`);
  if (!match) return null;
  const [teams, live, found, matches, standings] = await Promise.all([
    teamsById([match.homeTeam, match.awayTeam]),
    getJson<LiveMatch>(`/matches/${matchId}/live`),
    findSeason(match.seasonId),
    seasonMatches(match.seasonId),
    getJson<Standings>(`/standings/${match.seasonId}`),
  ]);
  return { match, teams, live, found, matches, standings };
}

export async function generateMetadata({ params }: PageProps<"/partidos/[matchId]">): Promise<Metadata> {
  const data = await load(Number((await params).matchId));
  if (!data) return { title: "Partido" };
  const title = `${teamName(data.teams, data.match.homeTeam)} vs ${teamName(data.teams, data.match.awayTeam)}`;
  return { title, description: `Marcador en vivo, línea de tiempo y plantillas de ${title}.` };
}

export default async function MatchPage({ params }: PageProps<"/partidos/[matchId]">) {
  await connection();
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId) || matchId < 1) notFound();
  const data = await load(matchId);
  if (!data) notFound();
  const { match, teams, live, found, matches, standings } = data;
  const home = teams.get(match.homeTeam) ?? { id: match.homeTeam, name: `Equipo ${match.homeTeam}`, categoryId: 0, players: [] };
  const away = teams.get(match.awayTeam) ?? { id: match.awayTeam, name: `Equipo ${match.awayTeam}`, categoryId: 0, players: [] };

  // Tabla de la temporada con los dos equipos resaltados (pestana "Tabla")
  const allTeams = await teamsById((standings?.standings ?? []).map((s) => s.teamId));
  const names = new Map([...allTeams].map(([id, t]) => [id, t.name]));
  const table =
    standings && standings.standings.length > 0 ? (
      <StandingsTable
        rows={standings.standings}
        names={names}
        form={formByTeam(matches ?? [])}
        highlight={[match.homeTeam, match.awayTeam]}
      />
    ) : (
      <p className="p-6 text-sm text-muted">La tabla de esta temporada todavía no está disponible.</p>
    );

  return (
    <main>
      <LiveBoard
        match={match}
        home={home}
        away={away}
        initial={live}
        competition={{
          seasonId: match.seasonId,
          name: found?.league.name ?? `Temporada ${match.seasonId}`,
          jornada: matches?.find((m) => m.id === match.id)?.jornada ?? null,
        }}
        table={table}
      />
    </main>
  );
}
