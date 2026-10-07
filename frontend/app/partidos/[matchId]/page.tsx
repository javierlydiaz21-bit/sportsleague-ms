import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import MatchDetail from "@/components/live-board";
import { seasonMatches, teamName, teamsById } from "@/lib/server-data";
import { getJson } from "@/lib/services";
import type { LiveMatch, Match } from "@/lib/types";

/** Partido (Fixture), equipos con su plantilla (Team), marcador (Live Score) y jornada. */
async function load(matchId: number) {
  const match = await getJson<Match>(`/matches/${matchId}`);
  if (!match) return null;
  const [teams, live, matches] = await Promise.all([
    teamsById([match.homeTeam, match.awayTeam]),
    getJson<LiveMatch>(`/matches/${matchId}/live`),
    seasonMatches(match.seasonId),
  ]);
  return { match, teams, live, jornada: matches?.find((m) => m.id === match.id)?.jornada ?? null };
}

export async function generateMetadata({ params }: PageProps<"/partidos/[matchId]">): Promise<Metadata> {
  const data = await load(Number((await params).matchId));
  if (!data) return { title: "Partido" };
  const title = `${teamName(data.teams, data.match.homeTeam)} vs ${teamName(data.teams, data.match.awayTeam)}`;
  return { title, description: `Marcador en vivo y eventos de ${title}.` };
}

export default async function MatchPage({ params }: PageProps<"/partidos/[matchId]">) {
  await connection();
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId) || matchId < 1) notFound();
  const data = await load(matchId);
  if (!data) notFound();
  const { match, teams, live, jornada } = data;
  const home = teams.get(match.homeTeam) ?? { id: match.homeTeam, name: `Equipo ${match.homeTeam}`, categoryId: 0, players: [] };
  const away = teams.get(match.awayTeam) ?? { id: match.awayTeam, name: `Equipo ${match.awayTeam}`, categoryId: 0, players: [] };
  return <MatchDetail match={match} home={home} away={away} initial={live} jornada={jornada} />;
}
