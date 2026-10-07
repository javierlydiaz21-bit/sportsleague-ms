import Crest from "@/components/crest";
import type { Result } from "@/lib/server-data";
import type { StandingRow } from "@/lib/types";

const RESULT_TITLE: Record<Result, string> = { G: "Ganó", E: "Empató", P: "Perdió" };

/** Racha de los últimos partidos (G/E/P), con letra y no solo color. */
export function FormGuide({ results }: { results: Result[] }) {
  if (!results.length) return <span className="text-muted">—</span>;
  return (
    <span className="form">
      {results.map((r, i) => (
        <span key={i} className={r} title={RESULT_TITLE[r]}>
          {r}
        </span>
      ))}
    </span>
  );
}

/**
 * Tabla de posiciones del diseño (Statistics Service: GET /standings/{seasonId}).
 * Compacta: #, equipo, PJ, DG y Pts; completa: además G, E y P.
 */
export default function StandingsTable({
  rows,
  names,
  form,
  highlight = [],
  compact = false,
}: {
  rows: StandingRow[];
  names: Map<number, string>;
  form?: Map<number, Result[]>;
  highlight?: number[];
  compact?: boolean;
}) {
  if (!rows.length) return <p className="empty">Todavía no hay partidos en esta temporada.</p>;
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <div className="scroll">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th className="num">PJ</th>
            {!compact && (
              <>
                <th className="num hide-sm">G</th>
                <th className="num hide-sm">E</th>
                <th className="num hide-sm">P</th>
              </>
            )}
            <th className="num">DG</th>
            <th className="num">Pts</th>
            {form && !compact && <th className="hide-md">Últimos 5</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className={highlight.includes(r.teamId) ? "hl" : undefined}>
              <td className="pos">{r.position}</td>
              <td>
                <span className="team-cell">
                  <Crest name={name(r.teamId)} id={r.teamId} size={28} />
                  {name(r.teamId)}
                </span>
              </td>
              <td className="num">{r.played}</td>
              {!compact && (
                <>
                  <td className="num hide-sm">{r.wins}</td>
                  <td className="num hide-sm">{r.draws}</td>
                  <td className="num hide-sm">{r.losses}</td>
                </>
              )}
              <td className="num">{signed(r.goalDifference)}</td>
              <td className="num pts">{r.points}</td>
              {form && !compact && (
                <td className="hide-md">
                  <FormGuide results={form.get(r.teamId) ?? []} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
