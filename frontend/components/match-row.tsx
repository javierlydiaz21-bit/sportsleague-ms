import Link from "next/link";
import Crest from "@/components/crest";
import type { MatchView } from "@/lib/server-data";

/** Estado del partido en la columna izquierda: minuto en vivo, "Final", etc. */
function StatusCell({ match }: { match: MatchView }) {
  if (match.status === "en_curso") {
    return (
      <span className="flex flex-col items-center font-semibold text-live">
        <span className="tabular-nums">{match.minute ? `${match.minute}'` : "Vivo"}</span>
        <span aria-hidden className="live-dot mt-1 h-1.5 w-1.5 rounded-full bg-live" />
      </span>
    );
  }
  const label = { finalizado: "Final", suspendido: "Susp.", programado: "Prog." }[match.status];
  const cls = { finalizado: "text-muted", suspendido: "text-async", programado: "text-muted" }[match.status];
  return <span className={`text-xs font-semibold ${cls}`}>{label}</span>;
}

/**
 * Fila compacta de un partido, como en las apps de resultados: estado, equipos uno
 * sobre otro con su escudo, y el marcador a la derecha (el ganador en negrita).
 */
export default function MatchRow({ match, home, away }: { match: MatchView; home: string; away: string }) {
  const s = match.score;
  const live = match.status === "en_curso";
  const played = s && (match.status === "finalizado" || live);
  const winner = played && match.status === "finalizado" ? (s.home > s.away ? "home" : s.away > s.home ? "away" : null) : null;
  const side = (name: string, goals: number | undefined, isWinner: boolean) => (
    <>
      <span className={`flex min-w-0 items-center gap-2 ${winner && !isWinner ? "text-muted" : ""}`}>
        <Crest name={name} size={20} />
        <span className={`truncate ${isWinner ? "font-semibold" : ""}`}>{name}</span>
      </span>
      <span className={`text-right tabular-nums ${live ? "text-live" : ""} ${isWinner ? "font-bold" : winner ? "text-muted" : "font-semibold"}`}>
        {played ? goals : ""}
      </span>
    </>
  );

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="grid grid-cols-[3.25rem_1fr] items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-surface-2"
      aria-label={`${home} ${played ? `${s.home} - ${s.away}` : "vs"} ${away}`}
    >
      <span className="flex justify-center border-r border-line pr-2 text-center">
        <StatusCell match={match} />
      </span>
      <span className="grid grid-cols-[1fr_2rem] gap-x-2 gap-y-1.5">
        {side(home, s?.home, winner === "home")}
        {side(away, s?.away, winner === "away")}
      </span>
    </Link>
  );
}
