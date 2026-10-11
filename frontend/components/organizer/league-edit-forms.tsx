"use client";

/*
 * Corrección de datos de una liga (Fase 3). Nada se borra: solo se corrige. Por el API Gateway:
 *   League Service .. PATCH /leagues/{id}        nombre y deporte (el deporte, solo sin calendario)
 *                     PATCH /seasons/{id}        año y fechas (sin dejar partidos fuera de la temporada)
 *                     PATCH /categories/{id}     nombre y rango de edad
 *   Team Service .... GET  /categories/{id}/eligibility-preview?ageRange=   qué jugadores cambiarían
 *                     POST /categories/{id}/eligibility/recalculate         después de corregir el rango
 * Cada formulario avisa antes de guardar un cambio que afecta partidos o jugadores.
 */

import { useState } from "react";
import { FormMessage } from "@/components/ui";
import { SPORTS, matchesOutside, normalizeName, validateCategory, validateLeague, validateSeason } from "@/lib/league-setup";
import { shortDate } from "@/lib/services";
import { ApiError, api } from "@/lib/session";
import type { Category, League, Match, Season } from "@/lib/types";
import { useSubmitLock, type Msg } from "./league-forms";

const day = (iso: string) => iso.slice(0, 10);

export function LeagueEditForm({ league, calendarSeason, onSaved }: { league: League; calendarSeason?: number; onSaved: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [sport, setSport] = useState(league.sport);
  // Nombre repetido que el organizador confirmó usar de todas formas
  const [twin, setTwin] = useState<string | null>(null);
  const { busy, run } = useSubmitLock();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    const error = validateLeague(name, sport);
    if (error) return setMsg({ tone: "error", text: error });
    const body: Record<string, unknown> = {};
    if (name !== league.name) body.name = name;
    if (sport !== league.sport) body.sport = sport;
    if (!Object.keys(body).length) return setMsg({ tone: "ok", text: "No hay cambios para guardar." });
    if (twin !== null && normalizeName(twin) === normalizeName(name)) body.confirmDuplicate = true;
    run(async () => {
      try {
        // League Service: PATCH /leagues/{id}
        await api("PATCH", `/leagues/${league.id}`, body);
        setTwin(null);
        setMsg({ tone: "ok", text: "Datos de la liga guardados." });
        onSaved();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && body.name && !body.confirmDuplicate && /liga llamada/.test(err.message)) {
          setTwin(name);
          setMsg({ tone: "error", text: `Ya tienes otra liga llamada ${name}. Si quieres usar el mismo nombre, vuelve a guardar.` });
          return;
        }
        setMsg({ tone: "error", text: (err as Error).message });
      }
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Corregir datos de la liga</h3>
      <div className="fgrid">
        <label className="fl full">
          Nombre de la liga
          <input name="name" defaultValue={league.name} maxLength={80} required onChange={() => setMsg(null)} />
        </label>
      </div>
      <fieldset className="sport-options" disabled={calendarSeason !== undefined}>
        <legend>Deporte</legend>
        {Object.entries(SPORTS).map(([key, label]) => (
          <label key={key} className={sport === key ? "is-on" : ""}>
            <input type="radio" name="sport" value={key} checked={sport === key} onChange={() => setSport(key)} />
            {label}
          </label>
        ))}
      </fieldset>
      {calendarSeason !== undefined && (
        <p className="hint">El deporte ya no se puede cambiar: la temporada {calendarSeason} tiene calendario.</p>
      )}
      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy}>
          {busy ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

export function SeasonEditForm({ season, matches, onSaved, onCancel }: { season: Season; matches: Match[]; onSaved: () => void; onCancel: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const { busy, run } = useSubmitLock();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const year = Number(fd.get("year"));
    const start = String(fd.get("startDate") ?? "");
    const end = String(fd.get("endDate") ?? "");
    const error = validateSeason(year, start, end);
    if (error) return setMsg({ tone: "error", text: error });
    if (year === season.year && start === day(season.startDate) && end === day(season.endDate)) {
      return setMsg({ tone: "ok", text: "No hay cambios para guardar." });
    }
    // Aviso antes de enviar: el League Service también lo rechaza (409)
    const outside = matchesOutside(matches, start, end);
    if (outside.length) {
      const days = outside.map((m) => m.scheduledAt).sort();
      return setMsg({
        tone: "error",
        text: `${outside.length === 1 ? "1 partido" : `${outside.length} partidos`} del calendario quedarían fuera de estas fechas (entre el ${shortDate(days[0])} y el ${shortDate(days[days.length - 1])}). Ajusta las fechas para que incluyan todo el calendario.`,
      });
    }
    run(async () => {
      try {
        // League Service: PATCH /seasons/{id}
        await api("PATCH", `/seasons/${season.id}`, { year, startDate: start, endDate: end });
        setMsg({ tone: "ok", text: `Temporada ${year} guardada.` });
        onSaved();
      } catch (err) {
        setMsg({ tone: "error", text: (err as Error).message });
      }
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Corregir la temporada {season.year}</h3>
      {matches.length > 0 && <p className="hint">Tiene calendario: las fechas deben incluir sus {matches.length} partidos.</p>}
      <div className="fgrid">
        <label className="fl">
          Año
          <input type="number" name="year" min={2000} max={2100} defaultValue={season.year} required />
        </label>
        <label className="fl">
          Fecha de inicio
          <input type="date" name="startDate" defaultValue={day(season.startDate)} required />
        </label>
        <label className="fl">
          Fecha de finalización
          <input type="date" name="endDate" defaultValue={day(season.endDate)} required />
        </label>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy}>
          {busy ? "Guardando..." : "Guardar cambios"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

interface Preview {
  players: number;
  becomeIneligible: number;
  becomeEligible: number;
  changes: { playerId: number; name: string | null; jerseyNumber: number; team: { name: string }; from: string; to: string }[];
}

const STATUS: Record<string, string> = { elegible: "elegible", no_elegible: "no elegible", pendiente: "pendiente" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function CategoryEditForm({ category, league, onSaved, onCancel }: { category: Category; league: League; onSaved: () => void; onCancel: () => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  // Impacto del rango nuevo que el organizador debe confirmar antes de guardar
  const [pending, setPending] = useState<{ body: Record<string, string>; preview: Preview } | null>(null);
  const [retryRecalc, setRetryRecalc] = useState(false);
  const { busy, run } = useSubmitLock();
  const [curMin, curMax] = category.ageRange.split("-");

  // Team Service: POST /categories/{id}/eligibility/recalculate
  async function recalculate() {
    const r = await api<{ updated: number }>("POST", `/categories/${category.id}/eligibility/recalculate`);
    setRetryRecalc(false);
    return r.updated;
  }

  async function save(body: Record<string, string>) {
    try {
      // League Service: PATCH /categories/{id}
      const c = await api<Category & { ageRangeChanged: boolean }>("PATCH", `/categories/${category.id}`, body);
      if (c.ageRangeChanged) {
        try {
          const updated = await recalculate();
          setMsg({ tone: "ok", text: `Categoría guardada. Elegibilidad recalculada: ${plural(updated, "jugador actualizado", "jugadores actualizados")}.` });
        } catch (err) {
          setRetryRecalc(true);
          setMsg({ tone: "error", text: `La categoría se guardó, pero no se pudo recalcular la elegibilidad: ${(err as Error).message}` });
        }
      } else {
        setMsg({ tone: "ok", text: "Categoría guardada." });
      }
      setPending(null);
      onSaved();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const min = Number(fd.get("minAge"));
    const max = Number(fd.get("maxAge"));
    const others = league.categories.filter((c) => c.id !== category.id).map((c) => c.name);
    const error = validateCategory(name, min, max, others);
    if (error) return setMsg({ tone: "error", text: error });
    const body: Record<string, string> = {};
    if (name !== category.name) body.name = name;
    const ageRange = `${min}-${max}`;
    if (ageRange !== category.ageRange) body.ageRange = ageRange;
    if (!Object.keys(body).length) return setMsg({ tone: "ok", text: "No hay cambios para guardar." });
    setMsg(null);
    run(async () => {
      if (body.ageRange) {
        try {
          // Team Service: GET /categories/{id}/eligibility-preview — advertencia antes de guardar
          const preview = await api<Preview>("GET", `/categories/${category.id}/eligibility-preview?ageRange=${body.ageRange}`);
          if (preview.changes.length) {
            setPending({ body, preview });
            return;
          }
        } catch (err) {
          setMsg({ tone: "error", text: `No se pudo revisar el impacto en los jugadores: ${(err as Error).message}` });
          return;
        }
      }
      await save(body);
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Corregir la categoría {category.name}</h3>
      <div className="fgrid">
        <label className="fl">
          Nombre
          <input name="name" defaultValue={category.name} maxLength={40} required onChange={() => setPending(null)} />
        </label>
        <label className="fl">
          Edad mínima
          <input type="number" name="minAge" min={3} max={99} defaultValue={curMin} required onChange={() => setPending(null)} />
        </label>
        <label className="fl">
          Edad máxima
          <input type="number" name="maxAge" min={3} max={99} defaultValue={curMax} required onChange={() => setPending(null)} />
        </label>
      </div>

      {pending && (
        <div className="twin-warning" role="alert">
          <p>
            Con {pending.body.ageRange.replace("-", " a ")} años,{" "}
            {[
              pending.preview.becomeIneligible ? `${plural(pending.preview.becomeIneligible, "jugador dejaría", "jugadores dejarían")} de ser elegible${pending.preview.becomeIneligible === 1 ? "" : "s"}` : "",
              pending.preview.becomeEligible ? `${plural(pending.preview.becomeEligible, "jugador pasaría", "jugadores pasarían")} a ser elegible${pending.preview.becomeEligible === 1 ? "" : "s"}` : "",
            ]
              .filter(Boolean)
              .join(" y ")}
            :
          </p>
          <ul className="plain-list">
            {pending.preview.changes.slice(0, 8).map((c) => (
              <li key={c.playerId}>
                #{c.jerseyNumber} {c.name ?? ""} ({c.team.name}): {STATUS[c.from] ?? c.from} → {STATUS[c.to] ?? c.to}
              </li>
            ))}
            {pending.preview.changes.length > 8 && <li>y {pending.preview.changes.length - 8} más</li>}
          </ul>
          <div className="factions">
            <button className="btn" type="button" disabled={busy} onClick={() => run(() => save(pending.body))}>
              Guardar de todas formas
            </button>
            <button className="btn" type="button" onClick={() => setPending(null)}>
              Revisar el rango
            </button>
          </div>
        </div>
      )}

      <div className="factions">
        <button className="btn btn-blue" type="submit" disabled={busy || pending !== null}>
          {busy ? "Guardando..." : "Guardar cambios"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
        {retryRecalc && (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                try {
                  const updated = await recalculate();
                  setMsg({ tone: "ok", text: `Elegibilidad recalculada: ${plural(updated, "jugador actualizado", "jugadores actualizados")}.` });
                } catch (err) {
                  setMsg({ tone: "error", text: (err as Error).message });
                }
              })
            }
          >
            Recalcular elegibilidad
          </button>
        )}
      </div>
      <FormMessage message={msg} />
    </form>
  );
}
