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
 * Tabla de posiciones: el líder marcado en dorado, escudos, puntos en cifras
 * condensadas y, en la versión completa, la racha de los últimos 5 partidos.
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
  const name = (id: number) => names.get(id) ?? `Equipo ${id}`;
  const dg = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <div className="scroll">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th className="num" title="Partidos jugados">
              PJ
            </th>
            {!compact && (
              <>
                <th className="num hide-sm" title="Ganados">
                  G
                </th>
                <th className="num hide-sm" title="Empatados">
                  E
                </th>
                <th className="num hide-sm" title="Perdidos">
                  P
                </th>
                <th className="num hide-md" title="Goles a favor y en contra">
                  Goles
                </th>
              </>
            )}
            <th className="num" title="Diferencia de goles">
              DG
            </th>
            <th className="num">Pts</th>
            {form && !compact && <th className="hide-md">Últimos 5</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.teamId} className={highlight.includes(s.teamId) ? "hl" : undefined}>
              <td className={`pos${s.position === 1 && s.played > 0 ? " lead" : ""}`}>{s.position}</td>
              <td>
                <span className="team-cell">
                  <Crest name={name(s.teamId)} size={28} />
                  {name(s.teamId)}
                </span>
              </td>
              <td className="num">{s.played}</td>
              {!compact && (
                <>
                  <td className="num hide-sm">{s.wins}</td>
                  <td className="num hide-sm">{s.draws}</td>
                  <td className="num hide-sm">{s.losses}</td>
                  <td className="num hide-md text-muted">
                    {s.goalsFor}:{s.goalsAgainst}
                  </td>
                </>
              )}
              <td className="num">{dg(s.goalDifference)}</td>
              <td className="num pts">{s.points}</td>
              {form && !compact && (
                <td className="hide-md">
                  <FormGuide results={form.get(s.teamId) ?? []} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
