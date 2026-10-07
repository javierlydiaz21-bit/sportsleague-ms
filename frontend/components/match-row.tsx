import Link from "next/link";
import Crest from "@/components/crest";
import { StatusChip } from "@/components/ui";
import type { MatchView } from "@/lib/server-data";

/** Marcador visible solo cuando el partido empezó. */
function scoreOf(match: MatchView) {
  const shows = match.status === "finalizado" || match.status === "en_curso";
  return shows ? (match.score ?? { home: 0, away: 0 }) : null;
}

function label(match: MatchView, home: string, away: string) {
  const s = scoreOf(match);
  return `${home} ${s ? `${s.home} a ${s.away}` : "contra"} ${away}`;
}

/** Ficha de un partido de la jornada: estado, minuto en vivo, equipos con su marcador y la cancha. */
export function MatchTile({ match, home, away, href }: { match: MatchView; home: string; away: string; href?: string }) {
  const s = scoreOf(match);
  return (
    <Link className="tile" href={href ?? `/partidos/${match.id}`} aria-label={label(match, home, away)}>
      <div className="tile-top">
        <StatusChip status={match.status} />
        {match.status === "en_curso" && match.minute !== null && <span className="tile-min">{match.minute}&apos;</span>}
      </div>
      <div className="tile-row">
        <Crest name={home} size={30} />
        <span>{home}</span>
        <b>{s?.home ?? ""}</b>
      </div>
      <div className="tile-row">
        <Crest name={away} size={30} />
        <span>{away}</span>
        <b>{s?.away ?? ""}</b>
      </div>
      <div className="tile-venue">{match.venue}</div>
    </Link>
  );
}

/** Fila de un partido en el calendario: local, marcador, visitante y estado con la cancha. */
export default function MatchRow({
  match,
  home,
  away,
  compact = false,
}: {
  match: MatchView;
  home: string;
  away: string;
  compact?: boolean;
}) {
  const s = scoreOf(match);
  return (
    <Link className={`match-row${compact ? " compact" : ""}`} href={`/partidos/${match.id}`} aria-label={label(match, home, away)}>
      <span className="mr-home">
        <span>{home}</span>
        <Crest name={home} size={28} />
      </span>
      <span className={`mr-score${s ? "" : " vs"}`}>{s ? `${s.home}–${s.away}` : "vs"}</span>
      <span className="mr-away">
        <Crest name={away} size={28} />
        <span>{away}</span>
      </span>
      <span className="mr-meta">
        <StatusChip status={match.status} />
        <span>{match.venue}</span>
      </span>
    </Link>
  );
}
