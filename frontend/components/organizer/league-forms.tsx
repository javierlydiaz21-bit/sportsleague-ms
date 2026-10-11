"use client";

/*
 * Formularios de la configuración guiada de una liga. Por el API Gateway:
 *   League Service .. POST /leagues/{id}/seasons       temporada
 *                     POST /seasons/{id}/categories    categoría (pertenece a la liga; la temporada solo da la ruta)
 *                     PUT  /categories/{id}/rules      reglamento (lo usa el Statistics Service para la tabla)
 * Los mensajes de éxito salen solo con la respuesta del servicio, y cada formulario
 * se bloquea mientras envía para no crear registros repetidos con un doble clic.
 */

import { useRef, useState } from "react";
import { FormMessage } from "@/components/ui";
import { TIEBREAKERS, validateCategory, validateRule, validateSeason } from "@/lib/league-setup";
import { api } from "@/lib/session";
import type { Category, League, Season } from "@/lib/types";

export type Msg = { tone: "ok" | "error"; text: string } | null;

/** Un solo envío a la vez, aunque se haga doble clic antes de que React vuelva a dibujar. */
export function useSubmitLock() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  async function run(task: () => Promise<boolean | void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    // Si la tarea devuelve true (por ejemplo, porque se va de la página) el bloqueo se mantiene
    let keep = false;
    try {
      keep = (await task()) === true;
    } finally {
      if (!keep) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return { busy, run };
}

/** ¿El botón con el que se envió el formulario fue "Guardar y continuar"? */
const wantsNext = (e: React.FormEvent<HTMLFormElement>) => (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "next";

export function SeasonForm({
  league,
  nextYear,
  onSaved,
}: {
  league: League;
  nextYear: number;
  onSaved: (season: Season, next: boolean) => void;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const { busy, run } = useSubmitLock();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const next = wantsNext(e);
    const fd = new FormData(form);
    const year = Number(fd.get("year"));
    const start = String(fd.get("startDate") ?? "");
    const end = String(fd.get("endDate") ?? "");
    const error = validateSeason(year, start, end);
    if (error) return setMsg({ tone: "error", text: error });
    run(async () => {
      try {
        // League Service: POST /leagues/{id}/seasons
        const s = await api<Season>("POST", `/leagues/${league.id}/seasons`, { year, startDate: start, endDate: end });
        form.reset();
        setMsg({ tone: "ok", text: `Temporada ${year} guardada.` });
        onSaved(s, next);
      } catch (err) {
        setMsg({ tone: "error", text: (err as Error).message });
      }
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>{league.seasons.length ? "Otra temporada" : "Define la temporada"}</h3>
      <div className="fgrid">
        <label className="fl">
          Año
          <input type="number" name="year" min={2000} max={2100} defaultValue={nextYear} required />
        </label>
        <label className="fl">
          Fecha de inicio
          <input type="date" name="startDate" required />
        </label>
        <label className="fl">
          Fecha de finalización
          <input type="date" name="endDate" required />
        </label>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" value="next" disabled={busy}>
          {busy ? "Guardando..." : "Guardar y continuar"}
        </button>
        <button className="btn" type="submit" value="stay" disabled={busy}>
          Guardar
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

export function CategoryForm({
  league,
  season,
  onSaved,
}: {
  league: League;
  season: Season;
  onSaved: (category: Category, next: boolean) => void;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const { busy, run } = useSubmitLock();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const next = wantsNext(e);
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const min = Number(fd.get("minAge"));
    const max = Number(fd.get("maxAge"));
    const error = validateCategory(
      name,
      min,
      max,
      league.categories.map((c) => c.name),
    );
    if (error) return setMsg({ tone: "error", text: error });
    run(async () => {
      try {
        // League Service: POST /seasons/{id}/categories (formato del servicio: "min-max")
        const c = await api<Category>("POST", `/seasons/${season.id}/categories`, { name, ageRange: `${min}-${max}` });
        form.reset();
        setMsg({ tone: "ok", text: `Categoría ${c.name} guardada (${min} a ${max} años).` });
        onSaved(c, next);
      } catch (err) {
        setMsg({ tone: "error", text: (err as Error).message });
      }
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>{league.categories.length ? "Otra categoría" : "Primera categoría"}</h3>
      <div className="fgrid">
        <label className="fl">
          Nombre
          <input name="name" placeholder="Sub-17" maxLength={40} required />
        </label>
        <label className="fl">
          Edad mínima
          <input type="number" name="minAge" min={3} max={99} placeholder="15" required />
        </label>
        <label className="fl">
          Edad máxima
          <input type="number" name="maxAge" min={3} max={99} placeholder="17" required />
        </label>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" value="next" disabled={busy}>
          {busy ? "Guardando..." : "Guardar y continuar"}
        </button>
        <button className="btn" type="submit" value="stay" disabled={busy}>
          Guardar y agregar otra
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}

/**
 * Reglamento de una categoría. Si ya hay partidos jugados (recalcSeasons), avisa antes de
 * guardar y después pide al Statistics Service que recalcule esas tablas con los puntos nuevos.
 *   Statistics Service .. POST /standings/{seasonId}/recalculate
 */
export function RuleForm({ category, recalcSeasons = [], onSaved }: { category: Category; recalcSeasons?: number[]; onSaved: (next: boolean) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const { busy, run } = useSubmitLock();
  const r = category.rule;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = wantsNext(e);
    const fd = new FormData(e.currentTarget);
    const pw = Number(fd.get("pointsWin"));
    const pd = Number(fd.get("pointsDraw"));
    const tb = String(fd.get("tiebreakerCriteria") ?? "");
    const error = validateRule(pw, pd, tb);
    if (error) return setMsg({ tone: "error", text: error });
    run(async () => {
      try {
        // League Service: PUT /categories/{id}/rules
        await api("PUT", `/categories/${category.id}/rules`, { pointsWin: pw, pointsDraw: pd, tiebreakerCriteria: tb });
      } catch (err) {
        setMsg({ tone: "error", text: (err as Error).message });
        return;
      }
      try {
        // Statistics Service: la tabla de las temporadas con partidos jugados usa el reglamento nuevo
        for (const seasonId of recalcSeasons) await api("POST", `/standings/${seasonId}/recalculate`);
        setMsg({ tone: "ok", text: `Reglamento de ${category.name} guardado.${recalcSeasons.length ? " La tabla de posiciones ya usa estos puntos." : ""}` });
      } catch (err) {
        setMsg({
          tone: "error",
          text: `Reglamento de ${category.name} guardado, pero no se pudo recalcular la tabla: ${(err as Error).message} Vuelve a guardar para intentarlo de nuevo.`,
        });
      }
      onSaved(next);
    });
  }

  return (
    <form className="f" noValidate onSubmit={submit}>
      <h3>Reglamento de {category.name}</h3>
      {recalcSeasons.length > 0 && (
        <p className="needs">Esta categoría ya tiene partidos jugados: al guardar, la tabla de posiciones se recalcula con el reglamento nuevo.</p>
      )}
      <div className="fgrid">
        <label className="fl">
          Puntos por victoria
          <input type="number" name="pointsWin" min={1} max={10} defaultValue={r ? r.pointsWin : 3} required />
        </label>
        <label className="fl">
          Puntos por empate
          <input type="number" name="pointsDraw" min={0} max={10} defaultValue={r ? r.pointsDraw : 1} required />
        </label>
        <label className="fl">
          Criterio de desempate
          <select name="tiebreakerCriteria" defaultValue={r?.tiebreakerCriteria ?? "diferencia_de_goles"}>
            {Object.entries(TIEBREAKERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="factions">
        <button className="btn btn-blue" type="submit" value="next" disabled={busy}>
          {busy ? "Guardando..." : "Guardar y continuar"}
        </button>
        <button className="btn" type="submit" value="stay" disabled={busy}>
          Guardar
        </button>
      </div>
      <FormMessage message={msg} />
    </form>
  );
}
