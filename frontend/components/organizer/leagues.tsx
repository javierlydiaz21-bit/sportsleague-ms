"use client";

/*
 * 1. Ligas y reglamento (diseño: viewLigas, ruta #/ligas). Por el API Gateway:
 *   League Service .. GET  /leagues (useLeague)        temporadas, categorías y reglamento de la liga activa
 *                     POST /leagues/{id}/seasons       nueva temporada
 *                     POST /seasons/{id}/categories    nueva categoría
 *                     PUT  /categories/{id}/rules      reglamento de una categoría
 *                     POST /leagues                    otra liga (fuera del diseño: el registro crea espectadores)
 *   Fixture Service . GET  /fixtures/{seasonId}        columna "Calendario" (jornadas de cada temporada)
 *   Team Service .... GET  /teams?ids={ids}            categoría del calendario de cada temporada
 */

import { useState } from "react";
import { useLeague } from "@/components/league-context";
import { FormMessage } from "@/components/ui";
import { SPORT_LABEL, TIEBREAKER_LABEL, cap, shortDate, utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useLoad } from "@/lib/use-api";
import type { Category, League, Match, Season, Team } from "@/lib/types";
import { PanelSection } from "./panel";

type Msg = { tone: "ok" | "error"; text: string } | null;
// Criterios de desempate del diseño
const TIEBREAK: Record<string, string> = { diferencia_de_goles: "diferencia de goles", goles_a_favor: "goles a favor" };

export default function LeaguesSection() {
  const { league } = useLeague();
  return (
    <PanelSection
      id="ligas"
      intro={`${league ? `${league.name}. ` : ""}Define las temporadas, las categorías y cómo se cuentan los puntos.`}
    >
      <Leagues />
    </PanelSection>
  );
}

function Leagues() {
  const { leagues, league, reload, setLeague } = useLeague();
  if (!leagues) return <p className="empty">Cargando...</p>;
  if (!league) {
    return (
      <NewLeague
        title="Todavía no tienes una liga"
        onDone={(id) => {
          setLeague(id);
          reload();
        }}
      />
    );
  }
  return (
    <>
      <LeagueBody key={league.id} league={league} reload={reload} />
      <NewLeague
        title="Otra liga"
        onDone={(id) => {
          setLeague(id);
          reload();
        }}
      />
    </>
  );
}

/** Jornadas y categoría del calendario de cada temporada (columna "Calendario"). */
async function loadCalendars(league: League) {
  const lists = await Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[])));
  const homes = [...new Set(lists.map((l) => l[0]?.homeTeam).filter((x): x is number => Boolean(x)))];
  const teams = homes.length ? await api<Team[]>("GET", `/teams?ids=${homes.join(",")}`).catch(() => [] as Team[]) : [];
  return new Map(
    league.seasons.map((s, i) => {
      const ms = lists[i];
      return [s.id, { rounds: new Set(ms.map((m) => utcDate(m.scheduledAt))).size, categoryId: teams.find((t) => t.id === ms[0]?.homeTeam)?.categoryId }];
    }),
  );
}

function LeagueBody({ league, reload }: { league: League; reload: () => void }) {
  const seasons = [...league.seasons].sort((a, b) => a.year - b.year || a.id - b.id);
  const cats = league.categories;
  const calendars = useLoad(`ligas:${league.id}:${seasons.map((s) => s.id).join(",")}`, () => loadCalendars(league));
  const [editRule, setEditRule] = useState<number | null>(null);
  const [ruleMsg, setRuleMsg] = useState<Msg>(null);
  const editing = cats.find((c) => c.id === editRule);
  const nextYear = seasons.length ? Math.max(...seasons.map((s) => s.year)) + 1 : new Date().getFullYear();

  const calendarText = (s: Season) => {
    const c = calendars.data?.get(s.id);
    if (!c) return "";
    if (!c.rounds) return "Sin calendario";
    const name = cats.find((x) => x.id === c.categoryId)?.name;
    return `${c.rounds} jornadas${name ? `, categoría ${name}` : ""}`;
  };

  return (
    <>
      <section className="card">
        <h2>Temporadas</h2>
        {seasons.length ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Calendario</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id}>
                    <td className="pos">{s.year}</td>
                    <td>{shortDate(s.startDate)}</td>
                    <td>{shortDate(s.endDate)}</td>
                    <td>{calendarText(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Todavía no hay temporadas. Crea la primera aquí abajo.</p>
        )}
        <NewSeason
          league={league}
          nextYear={nextYear}
          onDone={() => {
            reload();
            calendars.reload();
          }}
        />
      </section>

      <section className="card">
        <h2>Categorías</h2>
        <p className="hint">El rango de edad se usa para validar a cada jugador al ficharlo. Sin reglamento no se puede generar el calendario.</p>
        {cats.length ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Rango de edad</th>
                  <th>Reglamento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>{c.ageRange} años</td>
                    <td>
                      {c.rule ? (
                        `Victoria ${c.rule.pointsWin}, empate ${c.rule.pointsDraw}, desempate por ${TIEBREAKER_LABEL[c.rule.tiebreakerCriteria] ?? c.rule.tiebreakerCriteria}`
                      ) : (
                        <span className="elig elig-pendiente">Sin reglamento</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="linkish"
                        type="button"
                        onClick={() => {
                          setRuleMsg(null);
                          setEditRule(c.id);
                        }}
                      >
                        {c.rule ? "Editar reglamento" : "Definir reglamento"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Todavía no hay categorías.</p>
        )}
        {editing ? (
          <RuleForm
            key={editing.id}
            category={editing}
            msg={ruleMsg}
            setMsg={setRuleMsg}
            onCancel={() => {
              setRuleMsg(null);
              setEditRule(null);
            }}
            onDone={(text) => {
              setEditRule(null);
              setRuleMsg({ tone: "ok", text });
              reload();
            }}
          />
        ) : (
          <FormMessage message={ruleMsg} />
        )}
        {seasons.length ? (
          <NewCategory
            league={league}
            seasons={seasons}
            onDone={(c) => {
              // Como en el diseño: la categoría nueva abre su reglamento
              setEditRule(c.id);
              setRuleMsg({ tone: "ok", text: `Categoría ${c.name} creada. Ahora define su reglamento.` });
              reload();
            }}
          />
        ) : (
          <p className="empty">Para crear una categoría primero crea una temporada.</p>
        )}
      </section>
    </>
  );
}

function NewSeason({ league, nextYear, onDone }: { league: League; nextYear: number; onDone: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const year = Number(fd.get("year"));
    const start = String(fd.get("startDate"));
    const end = String(fd.get("endDate"));
    if (!(year >= 2000)) return setMsg({ tone: "error", text: "Escribe un año válido, por ejemplo 2027." });
    if (!start || !end) return setMsg({ tone: "error", text: "Elige la fecha de inicio y la de fin." });
    if (start >= end) return setMsg({ tone: "error", text: "La fecha de inicio debe ser anterior a la de fin." });
    setBusy(true);
    try {
      // League Service: POST /leagues/{id}/seasons
      await api<Season>("POST", `/leagues/${league.id}/seasons`, { year, startDate: start, endDate: end });
      form.reset();
      setMsg({ tone: "ok", text: `Temporada ${year} creada.` });
      onDone();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Nueva temporada</h3>
      <div className="fgrid">
        <label className="fl">
          Año
          <input type="number" name="year" min={2000} defaultValue={nextYear} />
        </label>
        <label className="fl">
          Inicio
          <input type="date" name="startDate" />
        </label>
        <label className="fl">
          Fin
          <input type="date" name="endDate" />
        </label>
        <button className="btn btn-blue" type="submit" disabled={busy}>
          Crear temporada
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

function NewCategory({ seasons, onDone }: { league: League; seasons: Season[]; onDone: (c: Category) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const seasonId = Number(fd.get("seasonId"));
    const name = String(fd.get("name")).trim();
    const ar = String(fd.get("ageRange")).trim();
    if (!name) return setMsg({ tone: "error", text: "Escribe el nombre de la categoría." });
    if (!/^\d{1,2}-\d{1,2}$/.test(ar)) return setMsg({ tone: "error", text: "Escribe el rango de edad como mínimo-máximo, por ejemplo 15-17." });
    const [min, max] = ar.split("-").map(Number);
    if (min > max) return setMsg({ tone: "error", text: "En el rango de edad, la edad mínima no puede ser mayor que la máxima." });
    setBusy(true);
    try {
      // League Service: POST /seasons/{id}/categories
      const c = await api<Category>("POST", `/seasons/${seasonId}/categories`, { name, ageRange: ar });
      form.reset();
      setMsg(null);
      onDone(c);
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Nueva categoría</h3>
      <div className="fgrid">
        <label className="fl">
          Temporada
          <select name="seasonId">
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year}
              </option>
            ))}
          </select>
        </label>
        <label className="fl">
          Nombre
          <input name="name" placeholder="Sub-17" />
        </label>
        <label className="fl">
          Rango de edad <small>mínimo-máximo</small>
          <input name="ageRange" placeholder="15-17" />
        </label>
        <button className="btn btn-blue" type="submit" disabled={busy}>
          Crear categoría
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

function RuleForm({
  category,
  msg,
  setMsg,
  onCancel,
  onDone,
}: {
  category: Category;
  msg: Msg;
  setMsg: (m: Msg) => void;
  onCancel: () => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const r = category.rule;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = Number(fd.get("pointsWin"));
    const pd = Number(fd.get("pointsDraw"));
    const tb = String(fd.get("tiebreakerCriteria"));
    if (!Number.isInteger(pw) || pw < 0 || !Number.isInteger(pd) || pd < 0) {
      return setMsg({ tone: "error", text: "Los puntos deben ser números enteros desde 0." });
    }
    setBusy(true);
    try {
      // League Service: PUT /categories/{id}/rules
      await api("PUT", `/categories/${category.id}/rules`, { pointsWin: pw, pointsDraw: pd, tiebreakerCriteria: tb });
      onDone(`Reglamento de ${category.name} guardado. Las tablas de posiciones ya usan estos puntos.`);
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Reglamento de {category.name}</h3>
      <div className="fgrid">
        <label className="fl">
          Puntos por victoria
          <input type="number" name="pointsWin" min={0} defaultValue={r ? r.pointsWin : 3} autoFocus />
        </label>
        <label className="fl">
          Puntos por empate
          <input type="number" name="pointsDraw" min={0} defaultValue={r ? r.pointsDraw : 1} />
        </label>
        <label className="fl">
          Criterio de desempate
          <select name="tiebreakerCriteria" defaultValue={r?.tiebreakerCriteria}>
            {Object.entries(TIEBREAK).map(([k, v]) => (
              <option key={k} value={k}>
                {cap(v)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy}>
          Guardar reglamento
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

/** Otra liga: no está en el diseño (allí la liga se crea al registrarse). */
function NewLeague({ title, onDone }: { title: string; onDone: (id: number) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("leagueName")).trim();
    const sport = String(fd.get("sport"));
    if (!name) return setMsg({ tone: "error", text: "Escribe el nombre de tu liga." });
    setBusy(true);
    try {
      // League Service: POST /leagues
      const l = await api<League>("POST", "/leagues", { name, sport });
      form.reset();
      setMsg({ tone: "ok", text: `${l.name} creada. Ya es tu liga activa.` });
      onDone(l.id);
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="hint">Cada liga tiene sus temporadas y categorías. La liga activa se cambia desde el menú de la cuenta.</p>
      <form noValidate onSubmit={submit}>
        <div className="fgrid">
          <label className="fl">
            Nombre de la liga
            <input name="leagueName" placeholder="Liga Municipal de Montería" />
          </label>
          <label className="fl">
            Deporte
            <select name="sport">
              {Object.entries(SPORT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-blue" type="submit" disabled={busy}>
            Crear liga
          </button>
        </div>
        <FormMessage message={msg} />
      </form>
    </section>
  );
}
