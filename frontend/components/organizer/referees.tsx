"use client";

/*
 * 3. Árbitros (diseño: viewArbitros, ruta #/arbitros). Por el API Gateway:
 *   Referee Service .. GET  /referees                       árbitros (con su cantidad de asignaciones)
 *                      POST /referees                       registrar árbitro
 *                      PUT  /referees/{id}/availability     editar disponibilidad
 *                      GET  /referees/{id}/assignments      asignación y confirmación de cada partido
 *   Fixture Service .. GET  /fixtures/{seasonId}            próximos partidos de la liga activa
 *   Team Service ..... GET  /teams?ids={ids}                nombres de los equipos
 *   API Gateway ...... GET/POST /auth/users                 cuentas de acceso de los árbitros (fuera del diseño)
 */

import { useState } from "react";
import { useLeague } from "@/components/league-context";
import { EmptyCard, FormMessage, Notice } from "@/components/ui";
import { shortDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useApi, useLoad } from "@/lib/use-api";
import type { Assignment, League, Match, Referee, Team, User } from "@/lib/types";
import { PanelSection } from "./panel";
import { DAYS, DAY_LABELS, dayNames } from "./shared";

type Msg = { tone: "ok" | "error"; text: string } | null;

export default function RefereesSection() {
  return (
    <PanelSection
      id="arbitros"
      intro="Al publicar una jornada, cada partido recibe un árbitro de la misma zona, certificado en la categoría y disponible ese día."
    >
      <Referees />
    </PanelSection>
  );
}

/** Árbitros de la liga, sus asignaciones y los próximos partidos. */
async function loadReferees(league: League) {
  const categoryIds = new Set(league.categories.map((c) => c.id));
  const [all, fixtures] = await Promise.all([
    api<Referee[]>("GET", "/referees"),
    Promise.all(league.seasons.map((s) => api<Match[]>("GET", `/fixtures/${s.id}`).catch(() => [] as Match[]))),
  ]);
  const referees = all.filter((r) => r.categoriesCertified.some((c) => categoryIds.has(c)));
  const lists = await Promise.all(
    referees.map((r) => api<Assignment[]>("GET", `/referees/${r.id}/assignments`).catch(() => [] as Assignment[])),
  );
  const upcoming = fixtures
    .flat()
    .filter((m) => m.status === "programado" || m.status === "en_curso")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
  const ids = [...new Set(upcoming.flatMap((m) => [m.homeTeam, m.awayTeam]))];
  const teams = ids.length ? await api<Team[]>("GET", `/teams?ids=${ids.join(",")}`).catch(() => [] as Team[]) : [];
  return {
    referees,
    byMatch: new Map(lists.flat().map((a) => [a.matchId, a])),
    upcoming,
    names: new Map(teams.map((t) => [t.id, t.name])),
  };
}

const dayChecks = (selected: string[]) =>
  DAYS.map((d, i) => (
    <label key={d}>
      <input type="checkbox" name="days" value={d} defaultChecked={selected.includes(d)} />
      {DAY_LABELS[i]}
    </label>
  ));

function Referees() {
  const { leagues, league } = useLeague();
  const data = useLoad(league ? `arbitros:${league.id}:${league.categories.length}:${league.seasons.length}` : null, () => loadReferees(league!));
  const [availEdit, setAvailEdit] = useState<number | null>(null);
  const [availMsg, setAvailMsg] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

  if (!leagues) return <p className="empty">Cargando...</p>;
  const cats = league?.categories ?? [];
  if (!cats.length) {
    return (
      <EmptyCard
        title="Todavía no hay categorías"
        text="Los árbitros se certifican por categoría. Créala primero en Ligas y reglamento."
        href="/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  const catNames = (ids: number[]) =>
    ids
      .map((id) => cats.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  const refs = data.data?.referees ?? [];
  const upcoming = data.data?.upcoming ?? [];
  const name = (id: number) => data.data?.names.get(id) ?? `Equipo ${id}`;

  async function saveAvailability(e: React.FormEvent<HTMLFormElement>, r: Referee) {
    e.preventDefault();
    const days = new FormData(e.currentTarget).getAll("days").map(String);
    if (!days.length) return setAvailMsg("Elige al menos un día disponible.");
    setBusy(true);
    try {
      // Referee Service: PUT /referees/{id}/availability
      await api("PUT", `/referees/${r.id}/availability`, { availability: days });
      setAvailEdit(null);
      setFlash(`Disponibilidad del árbitro #${r.id} actualizada.`);
      data.reload();
    } catch (err) {
      setAvailMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {flash && <Notice tone="ok">{flash}</Notice>}
      {data.error && <Notice tone="error">{data.error}</Notice>}
      <section className="card">
        <h2>Registrados</h2>
        {refs.length ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Árbitro</th>
                  <th>Zona</th>
                  <th>Categorías</th>
                  <th>Disponible</th>
                  <th className="num">Partidos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.id}>
                    <td className="pos">#{r.id}</td>
                    <td>{r.zone}</td>
                    <td>{catNames(r.categoriesCertified)}</td>
                    <td>
                      {availEdit === r.id ? (
                        <form className="inline-form checks" noValidate onSubmit={(e) => saveAvailability(e, r)}>
                          {dayChecks(r.availability)}
                          <button className="btn btn-blue btn-sm" type="submit" disabled={busy}>
                            Guardar
                          </button>
                          <button className="btn btn-sm" type="button" onClick={() => setAvailEdit(null)}>
                            Cancelar
                          </button>
                          {availMsg && (
                            <p className="form-msg is-error" role="alert">
                              {availMsg}
                            </p>
                          )}
                        </form>
                      ) : (
                        dayNames(r.availability)
                      )}
                    </td>
                    <td className="num">{r._count?.assignments ?? 0}</td>
                    <td>
                      {availEdit !== r.id && (
                        <button
                          className="linkish"
                          type="button"
                          onClick={() => {
                            setFlash("");
                            setAvailMsg("");
                            setAvailEdit(r.id);
                          }}
                        >
                          Editar disponibilidad
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{data.loading ? "Cargando..." : "Todavía no hay árbitros registrados en las categorías de esta liga."}</p>
        )}
        <NewReferee league={league!} onDone={data.reload} />
      </section>

      <section className="card">
        <h2>Asignaciones de los próximos partidos</h2>
        <p className="hint">Cada árbitro confirma su asignación desde su app.</p>
        {upcoming.length ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Partido</th>
                  <th className="hide-sm">Cancha</th>
                  <th>Árbitro</th>
                  <th>Confirmación</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m) => {
                  const a = data.data?.byMatch.get(m.id);
                  return (
                    <tr key={m.id}>
                      <td>{shortDate(m.scheduledAt)}</td>
                      <td>
                        {name(m.homeTeam)} contra {name(m.awayTeam)}
                      </td>
                      <td className="hide-sm">{m.venue}</td>
                      <td>{a ? `#${a.refereeId}` : "Sin árbitro disponible"}</td>
                      <td>
                        {a && (
                          <span className={`elig ${a.confirmed ? "elig-elegible" : "elig-pendiente"}`}>
                            {a.confirmed ? "Confirmada" : "Esperando confirmación"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{data.loading ? "Cargando..." : "No hay partidos programados."}</p>
        )}
      </section>

      <RefereeAccount referees={refs} />
    </>
  );
}

function NewReferee({ league, onDone }: { league: League; onDone: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const zone = String(fd.get("zone")).trim();
    const cats = fd.getAll("categories").map(Number);
    const days = fd.getAll("days").map(String);
    if (!zone) return setMsg({ tone: "error", text: "Escribe la zona del árbitro." });
    if (!cats.length) return setMsg({ tone: "error", text: "Elige al menos una categoría certificada." });
    if (!days.length) return setMsg({ tone: "error", text: "Elige al menos un día disponible." });
    setBusy(true);
    try {
      // Referee Service: POST /referees
      const r = await api<Referee>("POST", "/referees", { zone, categoriesCertified: cats, availability: days });
      form.reset();
      setMsg({ tone: "ok", text: `Árbitro #${r.id} registrado. Recibirá partidos de las jornadas que se publiquen.` });
      onDone();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Registrar árbitro</h3>
      <div className="fgrid">
        <label className="fl">
          Zona
          <input name="zone" defaultValue="monteria-norte" />
        </label>
        <fieldset className="checks">
          <legend>Categorías certificadas</legend>
          {league.categories.map((c) => (
            <label key={c.id}>
              <input type="checkbox" name="categories" value={c.id} />
              {c.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>Días disponibles</legend>
          {dayChecks(["sabado", "domingo"])}
        </fieldset>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy}>
          Registrar árbitro
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

/** Cuenta de acceso de un árbitro (fuera del diseño): con ella confirma sus partidos y registra los eventos. */
function RefereeAccount({ referees }: { referees: Referee[] }) {
  // API Gateway: GET /auth/users
  const users = useApi<User[]>("/auth/users");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const accountOf = (id: number) => users.data?.find((u) => u.refereeId === id);
  const without = referees.filter((r) => !accountOf(r.id));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const refereeId = Number(fd.get("refereeId"));
    const name = String(fd.get("name")).trim();
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    if (!refereeId) return setMsg({ tone: "error", text: "Elige el árbitro." });
    if (!name) return setMsg({ tone: "error", text: "Escribe el nombre del árbitro." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg({ tone: "error", text: "Escribe un correo válido, por ejemplo nombre@correo.com." });
    if (password.length < 8) return setMsg({ tone: "error", text: "La contraseña debe tener al menos 8 caracteres." });
    setBusy(true);
    try {
      // API Gateway: POST /auth/users (rol árbitro, enlazado a su id en el Referee Service)
      await api("POST", "/auth/users", { name, email, password, role: "arbitro", refereeId });
      form.reset();
      setMsg({ tone: "ok", text: `Cuenta creada: el árbitro #${refereeId} entra con ${email}.` });
      users.reload();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Cuentas de los árbitros</h2>
      <p className="hint">
        Con su cuenta, cada árbitro confirma sus partidos y registra goles, tarjetas y cambios.
        {users.data && referees.some((r) => accountOf(r.id)) && (
          <>
            {" "}
            Ya tienen cuenta:{" "}
            {referees
              .filter((r) => accountOf(r.id))
              .map((r) => `#${r.id} (${accountOf(r.id)!.email})`)
              .join(", ")}
            .
          </>
        )}
      </p>
      {without.length ? (
        <form noValidate onSubmit={submit}>
          <div className="fgrid">
            <label className="fl">
              Árbitro
              <select name="refereeId">
                {without.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.id}, {r.zone}
                  </option>
                ))}
              </select>
            </label>
            <label className="fl">
              Nombre
              <input name="name" autoComplete="off" />
            </label>
            <label className="fl">
              Correo
              <input type="email" name="email" autoComplete="off" />
            </label>
            <label className="fl">
              Contraseña <small>mínimo 8 caracteres</small>
              <input type="password" name="password" autoComplete="new-password" />
            </label>
            <button className="btn btn-blue" type="submit" disabled={busy}>
              Crear cuenta
            </button>
          </div>
          <FormMessage message={msg} />
        </form>
      ) : (
        <>
          <p className="empty">{referees.length ? "Todos los árbitros ya tienen cuenta." : "Registra un árbitro para crearle su cuenta."}</p>
          <FormMessage message={msg} />
        </>
      )}
    </section>
  );
}
