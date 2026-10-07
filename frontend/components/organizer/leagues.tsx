"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Field, FormMessage } from "@/components/ui";
import { SPORT_LABEL, TIEBREAKER_LABEL, cap, shortDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction } from "@/lib/use-api";
import type { Category, League, Season } from "@/lib/types";
import OrganizerSection from "./panel";
import { addDays, flatten, today } from "./shared";

export default function LeaguesSection() {
  return <OrganizerSection id="ligas">{(ctx) => <Leagues {...ctx} />}</OrganizerSection>;
}

function Leagues({ leagues, reload }: { leagues: League[]; reload: () => void }) {
  const { seasons, categories } = flatten(leagues);
  const [editing, setEditing] = useState<number | null>(null);
  const editingCategory = categories.find((c) => c.id === editing);

  return (
    <>
      <Card title="Ligas" hint="Cada liga tiene sus temporadas y sus categorías.">
        {leagues.length > 0 ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Liga</th>
                  <th>Deporte</th>
                  <th>Temporadas</th>
                  <th className="num">Categorías</th>
                </tr>
              </thead>
              <tbody>
                {leagues.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <b>{l.name}</b>
                    </td>
                    <td>{SPORT_LABEL[l.sport] ?? l.sport}</td>
                    <td>
                      {l.seasons.length
                        ? l.seasons.map((s, i) => (
                            <span key={s.id}>
                              {i > 0 && ", "}
                              <Link className="linkish" href={`/temporadas/${s.id}`}>
                                {s.year}
                              </Link>
                            </span>
                          ))
                        : "Ninguna"}
                    </td>
                    <td className="num">{l.categories.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Todavía no hay ligas. Crea la primera aquí abajo.</p>
        )}
        <NewLeague onDone={reload} />
      </Card>

      <Card title="Temporadas">
        {seasons.length > 0 ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Año</th>
                  {leagues.length > 1 && <th>Liga</th>}
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id}>
                    <td className="pos">{s.year}</td>
                    {leagues.length > 1 && <td>{s.league.name}</td>}
                    <td>{shortDate(s.startDate)}</td>
                    <td>{shortDate(s.endDate)}</td>
                    <td>
                      <Link className="linkish" href={`/temporadas/${s.id}`}>
                        Ver sitio público
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Todavía no hay temporadas.</p>
        )}
        {leagues.length > 0 ? <NewSeason leagues={leagues} onDone={reload} /> : <p className="empty">Para crear una temporada primero crea una liga.</p>}
      </Card>

      <Card
        title="Categorías"
        hint="El rango de edad se usa para validar a cada jugador al ficharlo. Sin reglamento no se puede generar el calendario."
      >
        {categories.length > 0 ? (
          <div className="scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Categoría</th>
                  {leagues.length > 1 && <th>Liga</th>}
                  <th>Rango de edad</th>
                  <th>Reglamento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    {leagues.length > 1 && <td>{c.league.name}</td>}
                    <td>{c.ageRange} años</td>
                    <td>
                      {c.rule ? (
                        `Victoria ${c.rule.pointsWin}, empate ${c.rule.pointsDraw}, desempate por ${TIEBREAKER_LABEL[c.rule.tiebreakerCriteria] ?? c.rule.tiebreakerCriteria}`
                      ) : (
                        <span className="elig elig-pendiente">Sin reglamento</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="linkish" onClick={() => setEditing(c.id)}>
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
        {editingCategory && (
          <RuleForm
            key={editingCategory.id}
            category={editingCategory}
            onCancel={() => setEditing(null)}
            onDone={reload}
          />
        )}
        {seasons.length > 0 ? (
          <NewCategory seasons={seasons} onDone={reload} />
        ) : (
          <p className="empty">Para crear una categoría primero crea una temporada.</p>
        )}
      </Card>
    </>
  );
}

const TIEBREAKERS = Object.entries(TIEBREAKER_LABEL);

function NewLeague({ onDone }: { onDone: () => void }) {
  const { busy, message, run } = useAction();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("futbol");
  return (
    <form
      className="f"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          const l = await api<League>("POST", "/leagues", { name, sport });
          setName("");
          return `Liga ${l.name} creada.`;
        });
        if (ok) onDone();
      }}
    >
      <h3>Nueva liga</h3>
      <div className="fgrid">
        <Field label="Nombre">
          <input required placeholder="Liga Municipal de Montería" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Deporte">
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            {Object.entries(SPORT_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-blue" disabled={busy}>
          Crear liga
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}

function NewSeason({ leagues, onDone }: { leagues: League[]; onDone: () => void }) {
  const { busy, message, run } = useAction();
  const [leagueId, setLeagueId] = useState(String(leagues.at(-1)!.id));
  const league = leagues.find((l) => String(l.id) === leagueId);
  const nextYear = league?.seasons.length ? Math.max(...league.seasons.map((s) => s.year)) + 1 : new Date().getFullYear();
  const [year, setYear] = useState("");
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(addDays(today(), 150));
  return (
    <form
      className="f"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          if (start >= end) throw new Error("La fecha de inicio debe ser anterior a la de fin.");
          const s = await api<Season>("POST", `/leagues/${leagueId}/seasons`, {
            year: Number(year || nextYear),
            startDate: start,
            endDate: end,
          });
          setYear("");
          return `Temporada ${s.year} creada.`;
        });
        if (ok) onDone();
      }}
    >
      <h3>Nueva temporada</h3>
      <div className="fgrid">
        {leagues.length > 1 && (
          <Field label="Liga">
            <select required value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Año">
          <input type="number" min={2000} placeholder={String(nextYear)} value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        <Field label="Inicio">
          <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fin">
          <input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <button className="btn btn-blue" disabled={busy}>
          Crear temporada
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}

function NewCategory({ seasons, onDone }: { seasons: Array<Season & { league: League }>; onDone: () => void }) {
  const { busy, message, run } = useAction();
  const [seasonId, setSeasonId] = useState(String(seasons.at(-1)!.id));
  const [name, setName] = useState("");
  const [ageRange, setAgeRange] = useState("15-17");
  const [pointsWin, setPointsWin] = useState("3");
  const [pointsDraw, setPointsDraw] = useState("1");
  const [tiebreaker, setTiebreaker] = useState("diferencia_de_goles");
  const many = new Set(seasons.map((s) => s.league.id)).size > 1;
  return (
    <form
      className="f"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          const [min, max] = ageRange.split("-").map(Number);
          if (min > max) throw new Error("En el rango de edad, la edad mínima no puede ser mayor que la máxima.");
          const c = await api<Category>("POST", `/seasons/${seasonId}/categories`, { name, ageRange });
          await api("PUT", `/categories/${c.id}/rules`, {
            pointsWin: Number(pointsWin),
            pointsDraw: Number(pointsDraw),
            tiebreakerCriteria: tiebreaker,
          });
          setName("");
          return `Categoría ${c.name} creada con su reglamento.`;
        });
        if (ok) onDone();
      }}
    >
      <h3>Nueva categoría y su reglamento</h3>
      <div className="fgrid">
        <Field label="Temporada">
          <select required value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {many ? `${s.league.name} ${s.year}` : s.year}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre">
          <input required placeholder="Sub-17" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rango de edad" hint="mínimo-máximo">
          <input required pattern="\d{1,2}-\d{1,2}" placeholder="15-17" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
        </Field>
        <Field label="Puntos por victoria">
          <input type="number" min={0} required value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} />
        </Field>
        <Field label="Puntos por empate">
          <input type="number" min={0} required value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} />
        </Field>
        <Field label="Criterio de desempate">
          <select value={tiebreaker} onChange={(e) => setTiebreaker(e.target.value)}>
            {TIEBREAKERS.map(([v, label]) => (
              <option key={v} value={v}>
                {cap(label)}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-blue" disabled={busy}>
          Crear categoría
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}

function RuleForm({ category, onCancel, onDone }: { category: Category; onCancel: () => void; onDone: () => void }) {
  const { busy, message, run } = useAction();
  const [pointsWin, setPointsWin] = useState(String(category.rule?.pointsWin ?? 3));
  const [pointsDraw, setPointsDraw] = useState(String(category.rule?.pointsDraw ?? 1));
  const [tiebreaker, setTiebreaker] = useState(category.rule?.tiebreakerCriteria ?? "diferencia_de_goles");
  return (
    <form
      className="f"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          await api("PUT", `/categories/${category.id}/rules`, {
            pointsWin: Number(pointsWin),
            pointsDraw: Number(pointsDraw),
            tiebreakerCriteria: tiebreaker,
          });
          return "Reglamento guardado.";
        });
        if (ok) onDone();
      }}
    >
      <h3>Reglamento de {category.name}</h3>
      <div className="fgrid">
        <Field label="Puntos por victoria">
          <input type="number" min={0} required autoFocus value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} />
        </Field>
        <Field label="Puntos por empate">
          <input type="number" min={0} required value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} />
        </Field>
        <Field label="Criterio de desempate">
          <select value={tiebreaker} onChange={(e) => setTiebreaker(e.target.value)}>
            {TIEBREAKERS.map(([v, label]) => (
              <option key={v} value={v}>
                {cap(label)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="factions">
        <button className="btn btn-blue" disabled={busy}>
          Guardar reglamento
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <FormMessage message={message} />
    </form>
  );
}
