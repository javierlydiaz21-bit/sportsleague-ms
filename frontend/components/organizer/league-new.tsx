"use client";

/*
 * Creación rápida de una liga (ruta /ligas/nueva): solo nombre y deporte. Por el API Gateway:
 *   League Service .. POST /leagues          crea la liga a nombre del organizador (x-user-id)
 *                     GET  /leagues/mine     Mis ligas, para avisar si ya existe un nombre parecido
 * Al confirmar el servicio, la liga queda activa y se abre su configuración guiada.
 * Si el organizador ya tiene una liga con ese nombre, el servicio responde 409 hasta que lo confirme.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLeague } from "@/components/league-context";
import { FormMessage } from "@/components/ui";
import { SPORTS, normalizeName, similarLeague, validateLeague } from "@/lib/league-setup";
import { ApiError, api } from "@/lib/session";
import type { League } from "@/lib/types";
import { useSubmitLock, type Msg } from "./league-forms";
import { PanelSection } from "./panel";

export default function NewLeagueSection() {
  return (
    <PanelSection
      id="ligas"
      title="Nueva liga"
      requireLeague={false}
      intro="Solo necesitas el nombre y el deporte. La temporada, las categorías y lo demás lo configuras después, paso a paso."
    >
      <QuickCreate />
    </PanelSection>
  );
}

function QuickCreate() {
  const router = useRouter();
  const { leagues, setLeague, reload } = useLeague();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  // Nombre parecido que el organizador ya confirmó que quiere repetir
  const [confirmed, setConfirmed] = useState("");
  // Nombre repetido que detectó el League Service (409) aunque la lista de la pantalla no lo tuviera
  const [serverTwin, setServerTwin] = useState<{ id: number; name: string } | null>(null);
  const { busy, run } = useSubmitLock();
  const twin = similarLeague(name, leagues ?? []) ?? (serverTwin && normalizeName(serverTwin.name) === normalizeName(name) ? serverTwin : undefined);
  const isConfirmed = confirmed !== "" && confirmed === normalizeName(name);
  const askTwin = Boolean(twin) && !isConfirmed;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validateLeague(name, sport);
    if (error) return setMsg({ tone: "error", text: error });
    if (askTwin) return setMsg(null);
    run(async () => {
      try {
        // League Service: POST /leagues (confirmDuplicate solo si el organizador confirmó el nombre repetido)
        const l = await api<League>("POST", "/leagues", { name: name.trim(), sport, ...(isConfirmed ? { confirmDuplicate: true } : {}) });
        setLeague(l.id);
        reload();
        router.push(`/ligas/${l.id}?nueva=1`);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setServerTwin({ id: 0, name: name.trim() });
          reload();
          return;
        }
        setMsg({ tone: "error", text: (err as Error).message });
      }
    });
  }

  return (
    <section className="card quick-create">
      <form noValidate onSubmit={submit}>
        <label className="fl">
          Nombre de la liga
          <input
            name="leagueName"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMsg(null);
            }}
            placeholder="Liga Barrial de Montería"
            maxLength={80}
            autoComplete="off"
            required
            aria-invalid={msg?.tone === "error" || undefined}
          />
        </label>

        <fieldset className="sport-options">
          <legend>Deporte</legend>
          {Object.entries(SPORTS).map(([key, label]) => (
            <label key={key} className={sport === key ? "is-on" : ""}>
              <input
                type="radio"
                name="sport"
                value={key}
                checked={sport === key}
                onChange={() => {
                  setSport(key);
                  setMsg(null);
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {askTwin && twin && (
          <div className="twin-warning" role="alert">
            <p>
              Ya tienes una liga llamada <b>{twin.name}</b>. ¿Quieres crear otra con un nombre parecido?
            </p>
            <div className="factions">
              <button className="btn" type="button" onClick={() => setConfirmed(normalizeName(name))}>
                Sí, crear otra
              </button>
              {twin.id > 0 && (
                <Link className="btn" href={`/ligas/${twin.id}`}>
                  Abrir {twin.name}
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="factions">
          <button className="btn btn-blue" type="submit" disabled={busy || askTwin}>
            {busy ? "Creando liga..." : "Crear liga"}
          </button>
          <Link className="btn" href="/ligas">
            Cancelar
          </Link>
        </div>
        <FormMessage message={msg} />
      </form>
    </section>
  );
}
