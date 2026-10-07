"use client";

import { useState } from "react";
import Crest from "@/components/crest";
import { Card, EmptyCard, Field, FormMessage } from "@/components/ui";
import { ageAt, shortDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Player, Team } from "@/lib/types";
import OrganizerSection from "./panel";
import { flatten } from "./shared";

const ELIGIBILITY = { elegible: "Elegible", no_elegible: "No elegible", pendiente: "Pendiente" };

export default function TeamsSection() {
  return <OrganizerSection id="equipos">{({ leagues }) => <Teams leagues={leagues} />}</OrganizerSection>;
}

function Teams({ leagues }: { leagues: League[] }) {
  const { categories } = flatten(leagues);
  const [categoryId, setCategoryId] = useState("");
  const category = categories.find((c) => String(c.id) === categoryId) ?? categories[0];
  const teams = useApi<Team[]>(category ? `/teams?categoryId=${category.id}` : null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const list = teams.data ?? [];
  const team = list.find((t) => t.id === teamId) ?? list[0];

  if (!category) {
    return (
      <EmptyCard
        title="Todavía no hay categorías"
        text="Cada equipo pertenece a una categoría. Créala primero en Ligas y reglamento."
        href="/organizador/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }
  const [min, max] = category.ageRange.split("-").map(Number);
  const many = leagues.length > 1;

  return (
    <>
      <div className="toolbar">
        <Field label="Categoría">
          <select
            value={category.id}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setTeamId(null);
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {many ? `${c.league.name}, ` : ""}
                {c.name} ({c.ageRange} años)
              </option>
            ))}
          </select>
        </Field>
      </div>
      {teams.error && <p className="form-msg is-error">{teams.error}</p>}
      <div className="split">
        <Card title="Equipos">
          {list.length > 0 ? (
            <ul className="team-list">
              {list.map((t) => (
                <li key={t.id}>
                  <button type="button" aria-current={t.id === team?.id} onClick={() => setTeamId(t.id)}>
                    <Crest name={t.name} size={30} />
                    {t.name}
                    <small aria-label={`${t.players?.length ?? 0} jugadores`}>{t.players?.length ?? 0}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{teams.loading ? "Cargando..." : "Esta categoría todavía no tiene equipos."}</p>
          )}
          <NewTeam
            categoryId={category.id}
            categoryName={category.name}
            onDone={(t) => {
              setTeamId(t.id);
              teams.reload();
            }}
          />
        </Card>

        <Card
          title={
            team ? (
              <>
                <Crest name={team.name} size={40} />
                {team.name}
              </>
            ) : (
              "Plantilla"
            )
          }
          actions={team && <p>{`${category.name} admite de ${min} a ${max} años`}</p>}
        >
          {team ? (
            <Roster key={team.id} team={team} onChange={teams.reload} />
          ) : (
            <p className="empty">Registra un equipo para ver y fichar su plantilla.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function NewTeam({ categoryId, categoryName, onDone }: { categoryId: number; categoryName: string; onDone: (t: Team) => void }) {
  const { busy, message, run } = useAction();
  const [name, setName] = useState("");
  return (
    <form
      className="f"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const t = await api<Team>("POST", "/teams", { name, categoryId });
          setName("");
          onDone(t);
          return `${t.name} registrado en ${categoryName}.`;
        });
      }}
    >
      <Field label={`Nuevo equipo en ${categoryName}`}>
        <input required placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="factions">
        <button className="btn btn-blue" disabled={busy}>
          Registrar equipo
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}

function Roster({ team, onChange }: { team: Team; onChange: () => void }) {
  const { busy, message, run } = useAction();
  const players = [...(team.players ?? [])].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("2010-05-14");
  const [jersey, setJersey] = useState(String(Math.max(0, ...players.map((p) => p.jerseyNumber)) + 1));

  return (
    <>
      {players.length > 0 ? (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Camiseta</th>
                <th>Nombre</th>
                <th className="hide-sm">Nacimiento</th>
                <th className="num">Edad</th>
                <th>Elegibilidad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="pos">#{p.jerseyNumber}</td>
                  <td>{p.name ?? "Sin nombre"}</td>
                  <td className="hide-sm">{shortDate(p.birthDate)}</td>
                  <td className="num">{ageAt(p.birthDate)}</td>
                  <td>
                    <span className={`elig elig-${p.eligibilityStatus}`}>{ELIGIBILITY[p.eligibilityStatus]}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await run(async () => {
                          const r = await api<Player>("PUT", `/players/${p.id}/eligibility`);
                          return `Jugador #${r.jerseyNumber} verificado: ${ELIGIBILITY[r.eligibilityStatus].toLowerCase()}.`;
                        });
                        if (ok) onChange();
                      }}
                    >
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

      <form
        className="f"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(async () => {
            const p = await api<Player>("POST", `/teams/${team.id}/players`, {
              name,
              birthDate,
              jerseyNumber: Number(jersey),
            });
            setName("");
            setJersey(String(Number(jersey) + 1));
            return `${p.name} fichado en ${team.name}: ${ELIGIBILITY[p.eligibilityStatus].toLowerCase()}. Tiene ${ageAt(p.birthDate)} años.`;
          });
          if (ok) onChange();
        }}
      >
        <h3>Fichar jugador</h3>
        <div className="fgrid">
          <Field label="Nombre">
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Número de camiseta">
            <input type="number" min={1} required value={jersey} onChange={(e) => setJersey(e.target.value)} />
          </Field>
          <button className="btn btn-blue" disabled={busy}>
            Fichar jugador
          </button>
        </div>
      </form>
      <FormMessage message={message} />
    </>
  );
}
