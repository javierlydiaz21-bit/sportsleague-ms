"use client";

import { useState } from "react";
import { Card, EmptyCard, Field, FormMessage } from "@/components/ui";
import { shortDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Referee, User } from "@/lib/types";
import OrganizerSection from "./panel";
import { DAYS, DAY_LABELS, dayNames, flatten, toggle, useAllMatches, useAssignments } from "./shared";

export default function RefereesSection() {
  return <OrganizerSection id="arbitros">{({ leagues }) => <Referees leagues={leagues} />}</OrganizerSection>;
}

function Referees({ leagues }: { leagues: League[] }) {
  const { categories } = flatten(leagues);
  const assignments = useAssignments();
  const users = useApi<User[]>("/auth/users");
  const matches = useAllMatches(leagues);
  const [editing, setEditing] = useState<number | null>(null);
  const { busy, message, run } = useAction();

  if (!categories.length) {
    return (
      <EmptyCard
        title="Todavía no hay categorías"
        text="Los árbitros se certifican por categoría. Créala primero en Ligas y reglamento."
        href="/organizador/ligas"
        label="Ir a Ligas y reglamento"
      />
    );
  }

  const referees = assignments.data?.referees ?? [];
  const accountOf = (refereeId: number) => users.data?.find((u) => u.refereeId === refereeId);
  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`;
  const name = (id: number) => matches.data?.names.get(id) ?? `Equipo ${id}`;
  const upcoming = (matches.data?.matches ?? [])
    .filter((m) => m.status === "programado" || m.status === "en_curso")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);

  return (
    <>
      <Card title="Registrados">
        {assignments.error && <p className="form-msg is-error">{assignments.error}</p>}
        {referees.length > 0 ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Árbitro</th>
                  <th>Zona</th>
                  <th>Categorías</th>
                  <th>Disponible</th>
                  <th className="num">Partidos</th>
                  <th className="hide-md">Cuenta</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {referees.map((r) => (
                  <tr key={r.id}>
                    <td className="pos">#{r.id}</td>
                    <td>{r.zone}</td>
                    <td>{r.categoriesCertified.map(categoryName).join(", ")}</td>
                    <td>
                      {editing === r.id ? (
                        <form
                          className="inline-form checks"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const days = new FormData(e.currentTarget).getAll("days").map(String);
                            const ok = await run(async () => {
                              if (!days.length) throw new Error("Elige al menos un día disponible.");
                              await api("PUT", `/referees/${r.id}/availability`, { availability: days });
                              return `Disponibilidad del árbitro #${r.id} actualizada.`;
                            });
                            if (ok) {
                              setEditing(null);
                              assignments.reload();
                            }
                          }}
                        >
                          {DAYS.map((d, i) => (
                            <label key={d}>
                              <input type="checkbox" name="days" value={d} defaultChecked={r.availability.includes(d)} />
                              {DAY_LABELS[i]}
                            </label>
                          ))}
                          <button className="btn btn-blue btn-sm" disabled={busy}>
                            Guardar
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        dayNames(r.availability)
                      )}
                    </td>
                    <td className="num">{r._count?.assignments ?? 0}</td>
                    <td className="hide-md text-muted">{accountOf(r.id)?.email ?? "Sin cuenta"}</td>
                    <td>
                      {editing !== r.id && (
                        <button type="button" className="linkish" onClick={() => setEditing(r.id)}>
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
          <p className="empty">{assignments.loading ? "Cargando..." : "Todavía no hay árbitros registrados."}</p>
        )}
        <FormMessage message={message} />
        <NewReferee
          categories={categories}
          many={leagues.length > 1}
          onDone={() => {
            assignments.reload();
            users.reload();
          }}
        />
      </Card>

      <Card title="Asignaciones de los próximos partidos" hint="Cada árbitro confirma su asignación desde su app.">
        {upcoming.length > 0 ? (
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
                  const a = assignments.data?.byMatch.get(m.id);
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{shortDate(m.scheduledAt)}</td>
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
          <p className="empty">{matches.loading ? "Cargando..." : "No hay partidos programados."}</p>
        )}
      </Card>
    </>
  );
}

function NewReferee({
  categories,
  many,
  onDone,
}: {
  categories: ReturnType<typeof flatten>["categories"];
  many: boolean;
  onDone: () => void;
}) {
  const { busy, message, run } = useAction();
  const [zone, setZone] = useState("monteria-norte");
  const [certified, setCertified] = useState<number[]>([]);
  const [days, setDays] = useState<string[]>(["sabado", "domingo"]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="f"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          if (certified.length === 0) throw new Error("Elige al menos una categoría certificada.");
          if (days.length === 0) throw new Error("Elige al menos un día disponible.");
          const r = await api<Referee>("POST", "/referees", { zone, categoriesCertified: certified, availability: days });
          if (email) {
            await api("POST", "/auth/users", { name: name || `Árbitro ${r.id}`, email, password, role: "arbitro", refereeId: r.id });
            return `Árbitro #${r.id} registrado con la cuenta ${email}. Recibirá partidos de las jornadas que se publiquen.`;
          }
          return `Árbitro #${r.id} registrado (sin cuenta de acceso). Recibirá partidos de las jornadas que se publiquen.`;
        });
        if (ok) {
          setEmail("");
          setPassword("");
          setName("");
          onDone();
        }
      }}
    >
      <h3>Registrar árbitro</h3>
      <div className="fgrid">
        <Field label="Zona">
          <input required value={zone} onChange={(e) => setZone(e.target.value)} />
        </Field>
        <fieldset className="checks">
          <legend>Categorías certificadas</legend>
          {categories.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={certified.includes(c.id)} onChange={() => setCertified(toggle(certified, c.id))} />
              {c.name}
              {many && <small>{c.league.name}</small>}
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>Días disponibles</legend>
          {DAYS.map((d, i) => (
            <label key={d}>
              <input type="checkbox" checked={days.includes(d)} onChange={() => setDays(toggle(days, d))} />
              {DAY_LABELS[i]}
            </label>
          ))}
        </fieldset>
        <p className="full text-sm text-muted">
          Cuenta de acceso (opcional): con ella el árbitro confirma sus partidos y registra los eventos desde la app.
        </p>
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Correo">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" hint="mínimo 8 caracteres">
          <input type="password" minLength={8} required={Boolean(email)} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
      <div className="factions">
        <button className="btn btn-blue" disabled={busy}>
          Registrar árbitro
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}
