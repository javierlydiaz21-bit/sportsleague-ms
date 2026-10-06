import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import LiveBoard from "@/components/live-board";
import { teamName, teamsById } from "@/lib/server-data";
import { getJson, utcDate, utcDay } from "@/lib/services";
import type { LiveMatch, Match } from "@/lib/types";

async function load(matchId: number) {
  const match = await getJson<Match>(`/matches/${matchId}`);
  if (!match) return null;
  const [teams, live] = await Promise.all([
    teamsById([match.homeTeam, match.awayTeam]),
    getJson<LiveMatch>(`/matches/${matchId}/live`),
  ]);
  return { match, teams, live };
}

export async function generateMetadata({ params }: PageProps<"/partidos/[matchId]">): Promise<Metadata> {
  const data = await load(Number((await params).matchId));
  if (!data) return { title: "Partido" };
  const title = `${teamName(data.teams, data.match.homeTeam)} vs ${teamName(data.teams, data.match.awayTeam)}`;
  return { title, description: `Marcador en vivo de ${title}.` };
}

export default async function MatchPage({ params }: PageProps<"/partidos/[matchId]">) {
  await connection();
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId) || matchId < 1) notFound();
  const data = await load(matchId);
  if (!data) notFound();
  const { match, teams, live } = data;
  const home = teams.get(match.homeTeam) ?? { id: match.homeTeam, name: `Equipo ${match.homeTeam}`, categoryId: 0, players: [] };
  const away = teams.get(match.awayTeam) ?? { id: match.awayTeam, name: `Equipo ${match.awayTeam}`, categoryId: 0, players: [] };

  return (
    <main className="space-y-6">
      <div>
        <Link href={`/temporadas/${match.seasonId}#calendario`} className="text-sm text-sync hover:underline">
          Volver al calendario
        </Link>
        <p className="mt-2 text-sm text-muted">
          {utcDay(match.scheduledAt)} {utcDate(match.scheduledAt)} · {match.venue}
        </p>
      </div>
      <LiveBoard match={match} home={home} away={away} initial={live} />
    </main>
  );
}
