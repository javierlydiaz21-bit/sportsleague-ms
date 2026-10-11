"use client";

/*
 * 1. Mis ligas (ruta /ligas): las ligas que creó el organizador de la sesión, con el estado de
 * su configuración. Las ligas sin propietario no aparecen aquí, pero no se ocultan ni se
 * modifican: el sitio público las sigue mostrando. Por el API Gateway:
 *   League Service .. GET /leagues/mine (useLeague)     ligas del organizador, temporadas, categorías y reglamento
 *   Team Service .... GET /teams?categoryId={id}        equipos por categoría     } estado de la
 *   Fixture Service . GET /fixtures/{seasonId}          partidos por temporada    } configuración
 *   Referee Service . GET /referees                     árbitros certificados     } (league-data.ts)
 */

import Link from "next/link";
import { useLeague } from "@/components/league-context";
import { Check } from "@/components/icons";
import { STAGE_ORDER, SPORTS, firstOpenStage, leagueStatus } from "@/lib/league-setup";
import { useLoad } from "@/lib/use-api";
import type { League } from "@/lib/types";
import { loadLeagueSetup, setupKey, stagesOf, type LeagueSetup } from "./league-data";
import { NoLeagues, PanelSection } from "./panel";

export default function LeaguesSection() {
  return (
    <PanelSection id="ligas" requireLeague={false} intro="Crea tus ligas y configúralas paso a paso: temporada, categorías, reglamento, equipos y calendario.">
      <MyLeagues />
    </PanelSection>
  );
}

function MyLeagues() {
  const { leagues, league: active, setLeague } = useLeague();
  const setups = useLoad(leagues?.length ? `mis-ligas:${leagues.map(setupKey).join("|")}` : null, () =>
    Promise.all((leagues ?? []).map(loadLeagueSetup)),
  );

  if (!leagues) return <p className="empty">Cargando tus ligas...</p>;
  if (!leagues.length) return <NoLeagues />;

  return (
    <section aria-labelledby="mis-ligas">
      <div className="squad-title">
        <div>
          <h2 id="mis-ligas">Tus ligas</h2>
          <p>
            {leagues.length === 1 ? "1 liga" : `${leagues.length} ligas`}. La liga activa es la que usan Equipos, Árbitros, Calendario y las demás secciones.
          </p>
        </div>
        <Link className="btn btn-blue" href="/ligas/nueva">
          Nueva liga
        </Link>
      </div>
      <div className="league-cards">
        {leagues.map((l, i) => (
          <LeagueCard key={l.id} league={l} setup={setups.data?.[i] ?? null} active={active?.id === l.id} onActivate={() => setLeague(l.id)} />
        ))}
      </div>
      {setups.error && <p className="empty">No se pudo calcular el avance de todas las ligas: {setups.error}</p>}
    </section>
  );
}

function LeagueCard({ league, setup, active, onActivate }: { league: League; setup: LeagueSetup | null; active: boolean; onActivate: () => void }) {
  const stages = setup ? stagesOf(setup) : null;
  const status = stages ? leagueStatus(stages) : null;
  const season = [...league.seasons].sort((a, b) => b.year - a.year)[0];
  const resume = stages ? firstOpenStage(stages) : STAGE_ORDER[0];

  return (
    <article className={`card league-card${active ? " is-active" : ""}`}>
      <div className="league-card-top">
        <span className="sport-tag">{SPORTS[league.sport] ?? league.sport}</span>
        {status ? (
          <span className={`badge ${status.ready ? "done" : "next"}`}>
            {status.ready && <Check />}
            {status.ready ? "Lista para operar" : "En configuración"}
          </span>
        ) : (
          <span className="badge">Calculando...</span>
        )}
      </div>
      <h3>{league.name}</h3>
      <p className="league-meta">{season ? `Temporada ${season.year}` : "Sin temporada todavía"}</p>
      {status && stages && (
        <div className="mini-progress" role="img" aria-label={`${status.done} de ${status.total} etapas completas`}>
          <div>
            {stages
              .filter((s) => s.id !== "revision")
              .map((s) => (
                <span key={s.id} className={`is-${s.state}`} title={`${s.label}: ${s.detail}`} />
              ))}
          </div>
          <p>
            {status.done} de {status.total} etapas completas
          </p>
        </div>
      )}
      <div className="factions">
        <Link className="btn btn-blue" href={`/ligas/${league.id}${status?.ready ? "" : `?etapa=${resume}`}`} onClick={onActivate}>
          {status?.ready ? "Administrar" : "Continuar configuración"}
        </Link>
        {active ? (
          <span className="badge done">
            <Check />
            Liga activa
          </span>
        ) : (
          <button className="btn" type="button" onClick={onActivate}>
            Usar como liga activa
          </button>
        )}
      </div>
    </article>
  );
}
