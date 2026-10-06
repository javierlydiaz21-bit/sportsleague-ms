import Link from "next/link";
import Crest from "@/components/crest";
import type { Result } from "@/lib/server-data";
import type { StandingRow } from "@/lib/types";

const RESULT_STYLE: Record<Result, string> = {
  G: "bg-ok text-pitch",
  E: "bg-muted/60 text-pitch",
  P: "bg-error text-pitch",
};
const RESULT_TITLE: Record<Result, string> = { G: "Ganó", E: "Empató", P: "Perdió" };

/** Racha de los ultimos partidos (G/E/P), con letra y no solo color. */
export function FormGuide({ results }: { results: Result[] }) {
  if (!results.length) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          title={RESULT_TITLE[r]}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${RESULT_STYLE[r]}`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

/**
 * Tabla de posiciones al estilo de las apps de resultados: franja de color para el
 * lider, escudos, columnas compactas y la racha de los ultimos 5 partidos.
 */
export default function StandingsTable({
  rows,
  names,
  form,
  highlight = [],
  compact = false,
  seasonId,
}: {
  rows: StandingRow[];
  names: Map<number, string>;
  form?: Map<number, Result[]>;
  highlight?: number[];
  compact?: boolean;
  seasonId?: number;
}) {
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="text-xs text-muted">
          <tr>
            <th className="w-8 py-2 pl-3 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Equipo</th>
            <th className="w-9 py-2 text-center font-semibold" title="Partidos jugados">PJ</th>
            {!compact && (
              <>
                <th className="w-8 py-2 text-center font-semibold" title="Ganados">G</th>
                <th className="w-8 py-2 text-center font-semibold" title="Empatados">E</th>
                <th className="w-8 py-2 text-center font-semibold" title="Perdidos">P</th>
                <th className="hidden w-14 py-2 text-center font-semibold sm:table-cell" title="Goles a favor y en contra">Goles</th>
              </>
            )}
            <th className="w-10 py-2 text-center font-semibold" title="Diferencia de goles">DG</th>
            <th className="w-10 py-2 pr-3 text-center font-semibold">Pts</th>
            {form && !compact && <th className="hidden py-2 pr-3 font-semibold md:table-cell">Últimos 5</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const mark = highlight.includes(s.teamId);
            return (
              <tr key={s.teamId} className={`border-t border-line ${mark ? "bg-sync/10" : ""}`}>
                <td className="relative py-2 pl-3 text-muted">
                  {s.position === 1 && s.played > 0 && (
                    <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-r bg-ok" />
                  )}
                  {s.position}
                </td>
                <td className="py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Crest name={name(s.teamId)} size={20} />
                    <span className={`truncate ${mark ? "font-semibold" : ""}`}>{name(s.teamId)}</span>
                  </span>
                </td>
                <td className="py-2 text-center">{s.played}</td>
                {!compact && (
                  <>
                    <td className="py-2 text-center">{s.wins}</td>
                    <td className="py-2 text-center">{s.draws}</td>
                    <td className="py-2 text-center">{s.losses}</td>
                    <td className="hidden py-2 text-center text-muted sm:table-cell">
                      {s.goalsFor}:{s.goalsAgainst}
                    </td>
                  </>
                )}
                <td className="py-2 text-center text-muted">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                <td className="py-2 pr-3 text-center font-bold">{s.points}</td>
                {form && !compact && (
                  <td className="hidden py-2 pr-3 md:table-cell">
                    <FormGuide results={form.get(s.teamId) ?? []} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {compact && seasonId && (
        <Link href={`/temporadas/${seasonId}?tab=posiciones`} className="block border-t border-line px-3 py-2 text-center text-sm text-sync hover:bg-surface-2">
          Ver tabla completa
        </Link>
      )}
    </div>
  );
}
