"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, Section } from "@/components/ui";
import { utcDate } from "@/lib/services";
import { api } from "@/lib/session";
import { useAction } from "@/lib/use-api";
import type { Category, League, Season } from "@/lib/types";
import { ActionMessage, SubTitle, addDays, flatten, today } from "./shared";

const TIEBREAKERS = [
  ["diferencia_de_goles", "Diferencia de goles"],
  ["goles_a_favor", "Goles a favor"],
  ["partidos_ganados", "Partidos ganados"],
];

export default function Leagues({ leagues, onChange }: { leagues: League[]; onChange: () => void }) {
  const { seasons } = flatten(leagues);
  const { busy, message, run } = useAction();

  const [leagueName, setLeagueName] = useState("");
  const [sport, setSport] = useState("futbol");
  const [seasonLeague, setSeasonLeague] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(addDays(today(), 150));
  const [catSeason, setCatSeason] = useState("");
  const [catName, setCatName] = useState("");
  const [ageRange, setAgeRange] = useState("15-17");
  const [pointsWin, setPointsWin] = useState("3");
  const [pointsDraw, setPointsDraw] = useState("1");
  const [tiebreaker, setTiebreaker] = useState("diferencia_de_goles");

  const done = async (action: () => Promise<string>) => {
    if (await run(action)) onChange();
  };

  return (
    <Section id="ligas" title="Ligas, temporadas y categorías" description="League Service: estructura de la competición y reglamento.">
      {leagues.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay ligas.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {leagues.map((l) => (
            <li key={l.id} className="rounded-md border border-line bg-surface-2 p-3">
              <p className="font-semibold">
                #{l.id} {l.name} <span className="text-muted">({l.sport})</span>
              </p>
              <p className="mt-1 text-muted">
                Temporadas:{" "}
                {l.seasons.length
                  ? l.seasons.map((s, i) => (
                      <span key={s.id}>
                        {i > 0 && ", "}
                        <Link href={`/temporadas/${s.id}`} className="text-sync hover:underline">
                          {s.year} (#{s.id})
                        </Link>
                      </span>
                    ))
                  : "ninguna"}
              </p>
              <p className="text-muted">
                Categorías:{" "}
                {l.categories.length
                  ? l.categories
                      .map(
                        (c) =>
                          `${c.name} #${c.id}, ${c.ageRange} años` +
                          (c.rule ? `, ${c.rule.pointsWin}/${c.rule.pointsDraw} pts` : ", sin reglamento"),
                      )
                      .join(" · ")
                  : "ninguna"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(async () => {
              const l = await api<League>("POST", "/leagues", { name: leagueName, sport });
              setLeagueName("");
              return `Liga #${l.id} creada.`;
            });
          }}
        >
          <SubTitle>Nueva liga</SubTitle>
          <div className="mt-2 space-y-2">
            <Field label="Nombre">
              <input className="field" required value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
            </Field>
            <Field label="Deporte">
              <select className="field" value={sport} onChange={(e) => setSport(e.target.value)}>
                <option value="futbol">Fútbol</option>
                <option value="basquet">Básquet</option>
                <option value="voley">Vóley</option>
              </select>
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              Crear liga
            </button>
          </div>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(async () => {
              const s = await api<Season>("POST", `/leagues/${seasonLeague}/seasons`, {
                year: Number(year),
                startDate: start,
                endDate: end,
              });
              return `Temporada ${s.year} (#${s.id}) creada.`;
            });
          }}
        >
          <SubTitle>Nueva temporada</SubTitle>
          <div className="mt-2 space-y-2">
            <Field label="Liga">
              <select className="field" required value={seasonLeague} onChange={(e) => setSeasonLeague(e.target.value)}>
                <option value="">Elige una liga</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Año">
              <input className="field" type="number" min={2000} required value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Inicio">
                <input className="field" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Fin">
                <input className="field" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              Crear temporada
            </button>
          </div>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(async () => {
              const c = await api<Category>("POST", `/seasons/${catSeason}/categories`, { name: catName, ageRange });
              await api("PUT", `/categories/${c.id}/rules`, {
                pointsWin: Number(pointsWin),
                pointsDraw: Number(pointsDraw),
                tiebreakerCriteria: tiebreaker,
              });
              setCatName("");
              return `Categoría ${c.name} (#${c.id}) creada con su reglamento.`;
            });
          }}
        >
          <SubTitle>Nueva categoría y reglamento</SubTitle>
          <div className="mt-2 space-y-2">
            <Field label="Temporada">
              <select className="field" required value={catSeason} onChange={(e) => setCatSeason(e.target.value)}>
                <option value="">Elige una temporada</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.league.name} {s.year} (desde {utcDate(s.startDate)})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nombre">
                <input className="field" required placeholder="Sub-17" value={catName} onChange={(e) => setCatName(e.target.value)} />
              </Field>
              <Field label="Edades" hint="min-max">
                <input className="field" required pattern="\d{1,2}-\d{1,2}" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
              </Field>
              <Field label="Pts victoria">
                <input className="field" type="number" min={0} required value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} />
              </Field>
              <Field label="Pts empate">
                <input className="field" type="number" min={0} required value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} />
              </Field>
            </div>
            <Field label="Criterio de desempate">
              <select className="field" value={tiebreaker} onChange={(e) => setTiebreaker(e.target.value)}>
                {TIEBREAKERS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              Crear categoría
            </button>
          </div>
        </form>
      </div>
      <ActionMessage message={message} />
    </Section>
  );
}
