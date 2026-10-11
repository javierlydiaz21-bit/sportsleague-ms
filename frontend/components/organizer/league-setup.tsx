"use client";

/*
 * Configuración guiada de una liga (ruta /ligas/{id}): seis etapas que se retoman donde quedaron.
 * El estado de cada etapa sale de datos guardados (lib/league-setup.ts), no de la pantalla.
 * Solo se configura una liga propia: las ligas sin propietario siguen intactas. Por el API Gateway:
 *   League Service .. GET  /leagues/{id}                  la liga con temporadas, categorías, reglamento y propietario
 *                     POST /leagues/{id}/seasons, POST /seasons/{id}/categories, PUT /categories/{id}/rules
 *   Team Service .... GET  /teams?categoryId={id}, POST /teams     equipos por categoría
 *   Fixture Service . GET  /fixtures/{seasonId}                     estado del calendario
 *   Referee Service . GET  /referees                                árbitros certificados en las categorías
 * El calendario no se genera aquí: se publica en Calendario, con vista previa y una acción explícita.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check } from "@/components/icons";
import { useLeague } from "@/components/league-context";
import { EmptyCard, Notice } from "@/components/ui";
import { SPORTS, STAGE_LABELS, STAGE_ORDER, TIEBREAKERS, firstOpenStage, leagueStatus, type Stage, type StageId } from "@/lib/league-setup";
import { shortDate, utcDate } from "@/lib/services";
import { useSession } from "@/lib/session";
import { useApi, useLoad } from "@/lib/use-api";
import type { League } from "@/lib/types";
import { CategoryForm, RuleForm, SeasonForm } from "./league-forms";
import { loadLeagueSetup, setupKey, stagesOf, type LeagueSetup } from "./league-data";
import { PanelSection } from "./panel";
import { dayNames } from "./shared";
import { NewTeam } from "./teams";

const STATE_LABEL: Record<Stage["state"], string> = { completada: "Completada", pendiente: "Pendiente", atencion: "Requiere atención" };
const isStage = (s?: string): s is StageId => STAGE_ORDER.includes(s as StageId);

export default function LeagueSetupSection({ id, stage, created }: { id: number; stage?: string; created: boolean }) {
  const { user } = useSession();
  const one = useApi<League>(Number.isInteger(id) && id > 0 ? `/leagues/${id}` : null);
  // El nombre de una liga ajena no se muestra en la banda: solo se configuran las propias
  const l = one.data && user && one.data.ownerId === user.id ? one.data : null;
  return (
    <PanelSection
      id="ligas"
      requireLeague={false}
      title={l?.name ?? "Configurar liga"}
      intro={l ? `${SPORTS[l.sport] ?? l.sport}. Todo se guarda al momento: puedes salir y continuar después.` : "Configura tu liga paso a paso."}
    >
      <Setup id={id} league={one.data} error={one.error} reloadLeague={one.reload} initial={isStage(stage) ? stage : null} created={created} />
    </PanelSection>
  );
}

interface StageProps {
  league: League;
  setup: LeagueSetup;
  stages: Stage[];
  go: (s: StageId) => void;
  refresh: () => void;
}

function Setup({
  id,
  league,
  error,
  reloadLeague,
  initial,
  created,
}: {
  id: number;
  league: League | null;
  error: string;
  reloadLeague: () => void;
  initial: StageId | null;
  created: boolean;
}) {
  const { user } = useSession();
  const { league: active, setLeague, reload: reloadMine } = useLeague();
  const owned = Boolean(league && user && league.ownerId === user.id);
  const setup = useLoad(owned && league ? `configurar:${setupKey(league)}` : null, () => loadLeagueSetup(league!));
  const [chosen, setChosen] = useState<StageId | null>(initial);
  const stepsRef = useRef<HTMLOListElement>(null);

  // La liga que se configura pasa a ser la liga activa del panel
  useEffect(() => {
    if (owned && active?.id !== id) setLeague(id);
  }, [owned, active?.id, id, setLeague]);

  // En pantallas angostas las etapas se desplazan de lado: deja visible la etapa actual
  useEffect(() => {
    const ol = stepsRef.current;
    const on = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!ol || !on || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollLeft += on.getBoundingClientRect().left - ol.getBoundingClientRect().left - (ol.clientWidth - on.offsetWidth) / 2;
  }, [chosen, setup.data]);

  if (error) {
    return <EmptyCard title="No encontramos esta liga" text="Puede que el enlace esté incompleto. Tus ligas están en Mis ligas." href="/ligas" label="Ir a Mis ligas" />;
  }
  if (!league || !user) return <p className="empty">Cargando la liga...</p>;
  if (!owned) {
    return (
      <EmptyCard
        title="Esta liga no está entre tus ligas"
        text="Solo puedes configurar las ligas que creaste. Esta liga no se modificó y sigue visible en el sitio público."
        href="/ligas"
        label="Ir a Mis ligas"
      />
    );
  }
  if (setup.error) return <Notice tone="error">No se pudo cargar la configuración: {setup.error}</Notice>;
  if (!setup.data) return <p className="empty">Cargando la configuración...</p>;

  const stages = stagesOf(setup.data);
  const current = chosen ?? firstOpenStage(stages);
  const idx = STAGE_ORDER.indexOf(current);
  const info = stages[idx];
  const status = leagueStatus(stages);

  const go = (s: StageId) => {
    setChosen(s);
    window.history.replaceState(null, "", `/ligas/${id}?etapa=${s}`);
    document.getElementById("etapa")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const refresh = () => {
    reloadLeague();
    setup.reload();
    reloadMine();
  };
  const props: StageProps = { league, setup: setup.data, stages, go, refresh };

  return (
    <>
      {created && <Notice tone="ok">{league.name} quedó creada. Empieza por la temporada; puedes continuar después cuando quieras.</Notice>}
      <div className="setup">
        <nav className="setup-steps" aria-label="Etapas de la configuración">
          <p className="setup-count">
            <b>
              {status.done} de {status.total}
            </b>{" "}
            etapas completas
          </p>
          <ol ref={stepsRef}>
            {stages.map((s, i) => (
              <li key={s.id}>
                <button type="button" className={`step is-${s.state}`} aria-current={s.id === current ? "step" : undefined} onClick={() => go(s.id)}>
                  <span className="step-mark" aria-hidden>
                    {s.state === "completada" ? <Check /> : i + 1}
                  </span>
                  <span className="step-text">
                    <b>{s.label}</b>
                    <small>
                      {STATE_LABEL[s.state]}
                      <span className="sr-only">: </span>
                      <span className="step-detail">{s.detail}</span>
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="card setup-panel" id="etapa" aria-labelledby="etapa-title">
          <div className="head">
            <div>
              <p className="eyebrow">
                Etapa {idx + 1} de {STAGE_ORDER.length}
              </p>
              <h2 id="etapa-title">{STAGE_LABELS[current]}</h2>
            </div>
            <span className={`state-chip is-${info.state}`}>{STATE_LABEL[info.state]}</span>
          </div>
          {current === "temporada" && <StageSeason {...props} />}
          {current === "categorias" && <StageCategories {...props} />}
          {current === "reglamento" && <StageRules {...props} />}
          {current === "equipos" && <StageTeams {...props} />}
          {current === "calendario" && <StageCalendar {...props} />}
          {current === "revision" && <StageReview {...props} />}
          <div className="setup-nav">
            {idx > 0 ? (
              <button className="btn" type="button" onClick={() => go(STAGE_ORDER[idx - 1])}>
                Volver
              </button>
            ) : (
              <span />
            )}
            <div className="factions">
              <Link className="btn" href="/ligas">
                Continuar después
              </Link>
              {idx < STAGE_ORDER.length - 1 && (
                <button className="btn" type="button" onClick={() => go(STAGE_ORDER[idx + 1])}>
                  Siguiente etapa
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const sortedSeasons = (league: League) => [...league.seasons].sort((a, b) => a.year - b.year || a.id - b.id);

/** Etapa que necesita otra antes: explica qué falta y lleva allí. */
function Blocked({ text, to, go }: { text: string; to: StageId; go: (s: StageId) => void }) {
  return (
    <div className="blocked">
      <p>{text}</p>
      <button className="btn btn-blue" type="button" onClick={() => go(to)}>
        Ir a {STAGE_LABELS[to]}
      </button>
    </div>
  );
}

function StageSeason({ league, setup, go, refresh }: StageProps) {
  const seasons = sortedSeasons(league);
  const nextYear = seasons.length ? Math.max(...seasons.map((s) => s.year)) + 1 : new Date().getFullYear();
  return (
    <>
      <p className="hint">La temporada fija el año y las fechas en que se juega. El calendario y las tablas se arman dentro de ella.</p>
      {seasons.length > 0 && (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Año</th>
                <th>Inicio</th>
                <th>Finalización</th>
                <th>Calendario</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => {
                const n = setup.matches[s.id]?.length ?? 0;
                return (
                  <tr key={s.id}>
                    <td className="pos">{s.year}</td>
                    <td>{shortDate(s.startDate)}</td>
                    <td>{shortDate(s.endDate)}</td>
                    <td>{n ? `${n} partidos` : "Sin calendario"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SeasonForm
        league={league}
        nextYear={nextYear}
        onSaved={(_, next) => {
          refresh();
          if (next) go("categorias");
        }}
      />
    </>
  );
}

function StageCategories({ league, setup, go, refresh }: StageProps) {
  const seasons = sortedSeasons(league);
  if (!seasons.length) return <Blocked text="Las categorías se crean dentro de una temporada. Primero define la temporada." to="temporada" go={go} />;
  const cats = league.categories;
  return (
    <>
      <p className="hint">Cada categoría tiene su rango de edad: con él se valida a cada jugador cuando se ficha.</p>
      {cats.length > 0 && (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Rango de edad</th>
                <th>Reglamento</th>
                <th className="num">Equipos</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>{c.ageRange.replace("-", " a ")} años</td>
                  <td>{c.rule ? "Definido" : <span className="elig elig-pendiente">Pendiente</span>}</td>
                  <td className="num">{setup.data.teamsPerCategory[c.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CategoryForm
        league={league}
        season={seasons[seasons.length - 1]}
        onSaved={(_, next) => {
          refresh();
          if (next) go("reglamento");
        }}
      />
    </>
  );
}

function StageRules({ league, go, refresh }: StageProps) {
  const cats = league.categories;
  const [selected, setSelected] = useState<number | null>(null);
  if (!cats.length) return <Blocked text="El reglamento se define para cada categoría. Primero crea una categoría." to="categorias" go={go} />;
  const current = cats.find((c) => c.id === selected) ?? cats.find((c) => !c.rule) ?? cats[0];
  return (
    <>
      <p className="hint">Puntos por victoria y por empate, y cómo se desempata la tabla. El Statistics Service usa estos valores al calcular las posiciones.</p>
      <ul className="rule-list">
        {cats.map((c) => (
          <li key={c.id} className={c.id === current.id ? "is-on" : ""}>
            <span>
              <b>{c.name}</b>
              <small>
                {c.rule
                  ? `Victoria ${c.rule.pointsWin}, empate ${c.rule.pointsDraw}, desempate por ${(TIEBREAKERS[c.rule.tiebreakerCriteria] ?? c.rule.tiebreakerCriteria).toLowerCase()}`
                  : "Sin reglamento"}
              </small>
            </span>
            {c.id !== current.id && (
              <button className="linkish" type="button" onClick={() => setSelected(c.id)}>
                {c.rule ? "Editar" : "Definir"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <RuleForm
        key={current.id}
        category={current}
        onSaved={(next) => {
          refresh();
          const missing = cats.filter((c) => !c.rule && c.id !== current.id);
          if (!next) return;
          if (missing.length) setSelected(missing[0].id);
          else go("equipos");
        }}
      />
    </>
  );
}

function StageTeams({ league, setup, go, refresh }: StageProps) {
  const cats = league.categories;
  if (!cats.length) return <Blocked text="Los equipos se inscriben en una categoría. Primero crea una categoría." to="categorias" go={go} />;
  return (
    <>
      <p className="hint">
        Registra los equipos de cada categoría: se necesitan al menos 2 para generar el calendario. Los jugadores se fichan en{" "}
        <Link href="/equipos">Equipos y jugadores</Link>, donde se valida su edad con el rango de la categoría.
      </p>
      {cats.map((c) => {
        const teams = setup.teams.filter((t) => t.categoryId === c.id);
        return (
          <div key={c.id} className="setup-block">
            <h3>
              {c.name} <small>{c.ageRange.replace("-", " a ")} años</small>
            </h3>
            <p className={teams.length < 2 ? "needs" : "hint"}>
              {teams.length === 1 ? "1 equipo" : `${teams.length} equipos`}
              {teams.length < 2 && ": faltan equipos para generar el calendario (mínimo 2)"}
            </p>
            {teams.length > 0 && (
              <ul className="chip-list">
                {teams.map((t) => (
                  <li key={t.id}>
                    {t.name} <small>{t.players?.length ?? 0} jugadores</small>
                  </li>
                ))}
              </ul>
            )}
            <NewTeam category={c} teams={teams} onDone={refresh} />
          </div>
        );
      })}
    </>
  );
}

function StageCalendar({ league, setup, stages }: StageProps) {
  const seasons = sortedSeasons(league);
  const catName = new Map(league.categories.map((c) => [c.id, c.name]));
  const anyCalendar = seasons.some((s) => (setup.matches[s.id]?.length ?? 0) > 0);
  const teamsReady = stages.find((s) => s.id === "equipos")?.state !== "pendiente";
  return (
    <>
      <p className="hint">
        El calendario se genera solo cuando tú lo publicas, con vista previa: eliges los equipos, las canchas, la primera jornada, los días entre jornadas y
        el descanso mínimo. Al publicarlo, cada partido recibe un árbitro de la zona, certificado en la categoría y disponible ese día.
      </p>
      <div className="setup-split">
        <div className="setup-block">
          <h3>Árbitros</h3>
          {setup.referees.length ? (
            <div className="scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Árbitro</th>
                    <th>Zona</th>
                    <th>Categorías</th>
                    <th>Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.referees.map((r) => (
                    <tr key={r.id}>
                      <td className="pos">#{r.id}</td>
                      <td>{r.zone}</td>
                      <td>{r.categoriesCertified.map((id) => catName.get(id)).filter(Boolean).join(", ")}</td>
                      <td>{dayNames(r.availability)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">Todavía no hay árbitros certificados en las categorías de esta liga.</p>
          )}
          <div className="factions">
            <Link className="btn" href="/arbitros">
              {setup.referees.length ? "Administrar árbitros" : "Registrar árbitros"}
            </Link>
          </div>
        </div>
        <div className="setup-block">
          <h3>Calendario</h3>
          {seasons.length ? (
            <ul className="plain-list">
              {seasons.map((s) => {
                const ms = setup.matches[s.id] ?? [];
                const rounds = new Set(ms.map((m) => utcDate(m.scheduledAt))).size;
                return (
                  <li key={s.id}>
                    Temporada {s.year}: {ms.length ? `${ms.length} partidos en ${rounds} jornadas` : "sin calendario"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Primero define la temporada.</p>
          )}
          <p className="hint">Por ahora cada temporada admite un calendario, para una de sus categorías.</p>
          <div className="factions">
            {anyCalendar || teamsReady ? (
              <Link className="btn btn-blue" href="/calendario">
                {anyCalendar ? "Ver el calendario" : "Generar el calendario"}
              </Link>
            ) : (
              <p className="needs">Registra al menos 2 equipos en una categoría para generar el calendario.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StageReview({ league, setup, stages, go }: StageProps) {
  const status = leagueStatus(stages);
  const seasons = sortedSeasons(league);
  const cats = league.categories;
  const open = stages.filter((s) => s.id !== "revision" && s.state !== "completada");
  const calendar = stages.find((s) => s.id === "calendario");
  return (
    <>
      <div className={`review-state${status.ready ? " is-ready" : ""}`}>
        <b>{status.ready ? "Lista para operar" : "En configuración"}</b>
        <span>
          {status.done} de {status.total} etapas completas
        </span>
      </div>
      <dl className="review">
        <dt>Liga</dt>
        <dd>
          {league.name}, {SPORTS[league.sport] ?? league.sport}
        </dd>
        <dt>Temporada</dt>
        <dd>{seasons.length ? seasons.map((s) => `${s.year}: ${shortDate(s.startDate)} a ${shortDate(s.endDate)}`).join("; ") : "Pendiente"}</dd>
        <dt>Categorías</dt>
        <dd>{cats.length ? cats.map((c) => `${c.name} (${c.ageRange.replace("-", " a ")} años)`).join("; ") : "Pendiente"}</dd>
        <dt>Reglamento</dt>
        <dd>
          {cats.length
            ? cats
                .map((c) =>
                  c.rule
                    ? `${c.name}: victoria ${c.rule.pointsWin}, empate ${c.rule.pointsDraw}, desempate por ${(TIEBREAKERS[c.rule.tiebreakerCriteria] ?? c.rule.tiebreakerCriteria).toLowerCase()}`
                    : `${c.name}: sin reglamento`,
                )
                .join("; ")
            : "Pendiente"}
        </dd>
        <dt>Equipos</dt>
        <dd>{cats.length ? cats.map((c) => `${c.name}: ${setup.data.teamsPerCategory[c.id] ?? 0}`).join("; ") : "Pendiente"}</dd>
        <dt>Calendario y arbitraje</dt>
        <dd>{calendar?.detail}</dd>
      </dl>
      {open.length > 0 && (
        <div className="blocked">
          <p>Para dejar la liga lista para operar falta completar:</p>
          <div className="factions">
            {open.map((s) => (
              <button key={s.id} className="btn" type="button" onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="setup-block">
        <h3>Guardado y publicación</h3>
        <p className="hint">
          Todo lo que ves aquí ya está guardado. Publicar la liga en el sitio público como una acción aparte llegará en una fase posterior; mientras tanto, el
          sitio público puede mostrar la información de todas las ligas, también la de esta.
        </p>
      </div>
    </>
  );
}
