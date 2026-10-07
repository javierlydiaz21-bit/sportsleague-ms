"use client";

/*
 * 2. Equipos y jugadores (diseño: viewEquipos, ruta #/equipos). Por el API Gateway:
 *   League Service .. GET  /leagues (useLeague)          categorías de la liga activa y su rango de edad
 *   Team Service .... GET  /teams?categoryId={id}        equipos de la categoría con su plantilla
 *                     POST /teams                        registrar equipo
 *                     POST /teams/{id}/players           fichar jugador (el Team Service consulta el rango al League Service)
 *                     PUT  /players/{id}/eligibility     volver a verificar la elegibilidad
 */

import { useState } from "react";
import Crest from "@/components/crest";
import { useLeague } from "@/components/league-context";
import { EmptyCard, FormMessage } from "@/components/ui";
import { ageAt, shortDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import type { Category, Player, Team } from "@/lib/types";
import { PanelSection } from "./panel";
import { today } from "./shared";

type Msg = { tone: "ok" | "error"; text: string } | null;
const ELIG: Record<Player["eligibilityStatus"], string> = { elegible: "Elegible", no_elegible: "No elegible", pendiente: "Pendiente" };

export default function TeamsSection() {
  return (
    <PanelSection id="equipos" intro="Al fichar a un jugador se compara su edad con el rango de su categoría.">
      <Teams />
    </PanelSection>
  );
}

function Teams() {
  const { leagues, league } = useLeague();
  const cats = league?.categories ?? [];
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const cat = cats.find((c) => c.id === categoryId) ?? cats[0];
  // Team Service: GET /teams?categoryId={id}
  const teams = useApi<Team[]>(cat ? `/teams?categoryId=${cat.id}` : null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const list = teams.data ?? [];
  const team = list.find((t) => t.id === teamId) ?? list[0] ?? null;

  if (!leagues) return <p className="empty">Cargando...</p>;
  if (!cat) {
    return (
      <EmptyCard
        title="Todavía no hay categorías"
        text="Cada equipo pertenece a una categoría. Créala primero en Ligas y reglamento."
        href="/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  const [min, max] = cat.ageRange.split("-").map(Number);

  return (
    <>
      <div className="toolbar">
        <label className="fl">
          Categoría
          <select
            value={cat.id}
            onChange={(e) => {
              setCategoryId(Number(e.target.value));
              setTeamId(null);
            }}
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.ageRange} años)
              </option>
            ))}
          </select>
        </label>
      </div>
      {teams.error && <p className="form-msg is-error">{teams.error}</p>}
      <div className="split">
        <section className="card">
          <h2>Equipos</h2>
          {list.length ? (
            <ul className="team-list">
              {list.map((x) => (
                <li key={x.id}>
                  <button type="button" aria-current={x.id === team?.id} onClick={() => setTeamId(x.id)}>
                    <Crest name={x.name} id={x.id} size={30} />
                    {x.name}
                    <small>{x.players?.length ?? 0}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{teams.loading ? "Cargando..." : "Esta categoría todavía no tiene equipos."}</p>
          )}
          <NewTeam
            key={cat.id}
            category={cat}
            teams={list}
            onDone={(t) => {
              setTeamId(t.id);
              teams.reload();
            }}
          />
        </section>

        <section className="card">
          {team ? (
            <>
              <div className="head">
                <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Crest name={team.name} id={team.id} size={40} />
                  {team.name}
                </h2>
                <p>
                  {cat.name} admite de {min} a {max} años
                </p>
              </div>
              <Roster key={team.id} team={team} category={cat} onChange={teams.reload} />
            </>
          ) : (
            <>
              <h2>Plantilla</h2>
              <p className="empty">Registra un equipo para ver y fichar su plantilla.</p>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function NewTeam({ category, teams, onDone }: { category: Category; teams: Team[]; onDone: (t: Team) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name")).trim();
    if (!name) return setMsg({ tone: "error", text: "Escribe el nombre del equipo." });
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return setMsg({ tone: "error", text: `Ya hay un equipo llamado ${name} en esta categoría.` });
    }
    setBusy(true);
    try {
      // Team Service: POST /teams
      const t = await api<Team>("POST", "/teams", { name, categoryId: category.id });
      form.reset();
      setMsg({ tone: "ok", text: `${name} registrado en ${category.name}.` });
      onDone(t);
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <label className="fl">
        Nuevo equipo en {category.name}
        <input name="name" placeholder="Nombre del equipo" />
      </label>
      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy}>
          Registrar equipo
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

function Roster({ team, category, onChange }: { team: Team; category: Category; onChange: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const roster = [...(team.players ?? [])].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const [min, max] = category.ageRange.split("-").map(Number);
  const age = (birth: string) => ageAt(birth, today());

  async function verify(p: Player) {
    setBusy(true);
    try {
      // Team Service: PUT /players/{id}/eligibility
      const r = await api<Player>("PUT", `/players/${p.id}/eligibility`);
      const before = p.eligibilityStatus;
      const now = r.eligibilityStatus;
      setMsg({
        tone: "ok",
        text: `Jugador #${p.jerseyNumber} verificado: ${ELIG[now].toLowerCase()}${before !== now ? ` (antes estaba ${ELIG[before].toLowerCase()})` : ""}.`,
      });
      onChange();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const bd = String(fd.get("birthDate"));
    const j = Number(fd.get("jerseyNumber"));
    if (!bd) return setMsg({ tone: "error", text: "Elige la fecha de nacimiento." });
    if (!Number.isInteger(j) || j < 1) return setMsg({ tone: "error", text: "Escribe un número de camiseta desde 1." });
    setBusy(true);
    try {
      // Team Service: POST /teams/{id}/players (la elegibilidad la decide con el rango de la categoría)
      const p = await api<Player>("POST", `/teams/${team.id}/players`, { birthDate: bd, jerseyNumber: j });
      form.reset();
      setMsg({
        tone: "ok",
        text: `Jugador #${j} fichado en ${team.name}: ${ELIG[p.eligibilityStatus].toLowerCase()}. Tiene ${age(bd)} años y ${category.name} admite de ${min} a ${max}.`,
      });
      onChange();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {roster.length ? (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Camiseta</th>
                <th>Nacimiento</th>
                <th className="num">Edad</th>
                <th>Elegibilidad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id}>
                  <td className="pos">#{p.jerseyNumber}</td>
                  <td>{shortDate(p.birthDate)}</td>
                  <td className="num">{age(p.birthDate)}</td>
                  <td>
                    <span className={`elig elig-${p.eligibilityStatus}`}>{ELIG[p.eligibilityStatus]}</span>
                  </td>
                  <td>
                    <button className="linkish" type="button" disabled={busy} onClick={() => verify(p)}>
                      Verificar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">Todavía no tiene jugadores. Ficha el primero aquí abajo.</p>
      )}
      <form className="f" noValidate onSubmit={submit}>
        <h3>Fichar jugador</h3>
        <div className="fgrid">
          <label className="fl">
            Fecha de nacimiento
            <input type="date" name="birthDate" />
          </label>
          <label className="fl">
            Número de camiseta
            <input type="number" name="jerseyNumber" min={1} />
          </label>
          <button className="btn btn-blue" type="submit" disabled={busy}>
            Fichar jugador
          </button>
        </div>
        <FormMessage message={msg} />
      </form>
    </>
  );
}
