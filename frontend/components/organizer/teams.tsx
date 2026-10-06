"use client";

import { useState } from "react";
import { Field, Section } from "@/components/ui";
import { utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Player, Team } from "@/lib/types";
import { ActionMessage, SubTitle, flatten } from "./shared";

const ELIGIBILITY = {
  elegible: { label: "Elegible", cls: "bg-ok/15 text-ok" },
  no_elegible: { label: "No elegible", cls: "bg-error/15 text-error" },
  pendiente: { label: "Pendiente", cls: "bg-async/15 text-async" },
};

export default function Teams({ leagues }: { leagues: League[] }) {
  const { categories } = flatten(leagues);
  const [categoryId, setCategoryId] = useState("");
  const selected = categoryId || (categories[0] ? String(categories[0].id) : "");
  const teams = useApi<Team[]>(selected ? `/teams?categoryId=${selected}` : null);
  const { busy, message, run } = useAction();

  const [teamName, setTeamName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [birthDate, setBirthDate] = useState("2010-05-14");
  const [jersey, setJersey] = useState("10");

  const done = async (action: () => Promise<string>) => {
    if (await run(action)) teams.reload();
  };
  const category = categories.find((c) => String(c.id) === selected);

  return (
    <Section
      id="equipos"
      title="Equipos y jugadores"
      description="Team Service: al fichar un jugador se consulta el rango de edad de la categoría al League Service."
    >
      {categories.length === 0 ? (
        <p className="text-sm text-muted">Crea primero una categoría.</p>
      ) : (
        <>
          <Field label="Categoría">
            <select className="field max-w-sm" value={selected} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.league.name}, {c.name} ({c.ageRange} años)
                </option>
              ))}
            </select>
          </Field>

          {teams.error && <p className="mt-3 text-sm text-error">{teams.error}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(teams.data ?? []).map((t) => (
              <TeamCard key={t.id} team={t} onChange={teams.reload} />
            ))}
            {teams.data?.length === 0 && <p className="text-sm text-muted">Esta categoría todavía no tiene equipos.</p>}
          </div>

          <div className="mt-2 grid gap-6 md:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                done(async () => {
                  const t = await api<Team>("POST", "/teams", { name: teamName, categoryId: Number(selected) });
                  setTeamName("");
                  return `Equipo ${t.name} (#${t.id}) registrado en ${category?.name}.`;
                });
              }}
            >
              <SubTitle>Registrar equipo</SubTitle>
              <div className="mt-2 flex gap-2">
                <input
                  className="field mt-0 flex-1"
                  aria-label="Nombre del equipo"
                  placeholder="Nombre del equipo"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
                <button className="btn btn-primary" disabled={busy}>
                  Registrar
                </button>
              </div>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                done(async () => {
                  const p = await api<Player>("POST", `/teams/${playerTeam}/players`, {
                    name: playerName,
                    birthDate,
                    jerseyNumber: Number(jersey),
                  });
                  setPlayerName("");
                  setJersey(String(Number(jersey) + 1));
                  return `${p.name} fichado: ${ELIGIBILITY[p.eligibilityStatus].label.toLowerCase()}.`;
                });
              }}
            >
              <SubTitle>Fichar jugador</SubTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Equipo">
                  <select className="field" required value={playerTeam} onChange={(e) => setPlayerTeam(e.target.value)}>
                    <option value="">Elige</option>
                    {(teams.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre">
                  <input className="field" required value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
                </Field>
                <Field label="Nacimiento">
                  <input className="field" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </Field>
                <Field label="Camiseta">
                  <input className="field" type="number" min={1} required value={jersey} onChange={(e) => setJersey(e.target.value)} />
                </Field>
              </div>
              <button className="btn btn-primary mt-2" disabled={busy}>
                Fichar
              </button>
            </form>
          </div>
          <ActionMessage message={message} />
        </>
      )}
    </Section>
  );
}

function TeamCard({ team, onChange }: { team: Team; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3 text-sm">
      <p className="font-semibold">
        {team.name} <span className="text-muted">#{team.id}</span>
      </p>
      {team.players && team.players.length > 0 ? (
        <table className="mt-2 w-full text-left">
          <tbody>
            {team.players.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1 pr-2 tabular-nums text-muted">{p.jerseyNumber}</td>
                <td className="py-1 pr-2">{p.name ?? "Sin nombre"}</td>
                <td className="py-1 pr-2 text-muted">{utcDate(p.birthDate)}</td>
                <td className="py-1 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ELIGIBILITY[p.eligibilityStatus].cls}`}>
                    {ELIGIBILITY[p.eligibilityStatus].label}
                  </span>
                  {p.eligibilityStatus === "pendiente" && (
                    <button
                      className="ml-2 text-xs text-sync hover:underline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("PUT", `/players/${p.id}/eligibility`);
                          onChange();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Verificar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 text-muted">Sin jugadores.</p>
      )}
    </div>
  );
}
