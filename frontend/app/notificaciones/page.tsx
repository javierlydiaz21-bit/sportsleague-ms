"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Band, Card, FormMessage, LoginRequired, Notice, Page } from "@/components/ui";
import { api, useSession } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, NotificationFeed, Team } from "@/lib/types";

const KIND: Record<string, string> = {
  horario_confirmado: "Horario confirmado",
  cambio_de_sede: "Cambio de sede",
  resultado_final: "Resultado final",
  partido_suspendido: "Partido suspendido",
  prueba: "Prueba",
};

export default function NotificationsPage() {
  const { user, ready } = useSession();
  const feed = useApi<NotificationFeed>(user ? `/notifications/${user.id}` : null);
  const leagues = useApi<League[]>(user ? "/leagues" : null);
  const [teams, setTeams] = useState<Array<Team & { label: string }>>([]);
  const { busy, message, run } = useAction();
  const [draft, setDraft] = useState<{ followedTeams: number[]; channels: string[] } | null>(null);
  const prefs = draft ?? feed.data?.preferences ?? { followedTeams: [], channels: [] };

  // Equipos de todas las categorías, para elegir a cuáles seguir
  useEffect(() => {
    if (!leagues.data) return;
    let cancelled = false;
    const categories = leagues.data.flatMap((l) => l.categories.map((c) => ({ ...c, leagueName: l.name })));
    Promise.all(
      categories.map((c) =>
        api<Team[]>("GET", `/teams?categoryId=${c.id}`)
          .then((list) => list.map((t) => ({ ...t, label: `${c.leagueName}, ${c.name}` })))
          .catch(() => []),
      ),
    ).then((lists) => {
      if (!cancelled) setTeams(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [leagues.data]);

  // Los avisos llegan por eventos; se consulta de nuevo cada 15 s mientras la página está abierta
  const reload = feed.reload;
  useEffect(() => {
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [reload]);

  if (!ready) return null;
  if (!user) return <LoginRequired />;

  const toggle = (key: "followedTeams" | "channels", value: number | string) => {
    const list = prefs[key] as Array<number | string>;
    setDraft({ ...prefs, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  return (
    <>
      <Band
        icon="avisos"
        title="Avisos"
        intro="Horarios confirmados, cambios de sede, resultados finales y suspensiones de los equipos que sigues."
      />
      <Page>
        {feed.error && <Notice tone="error">{feed.error}</Notice>}
        <div className="cols">
          <Card
            id="avisos"
            title="Recientes"
            hint={prefs.followedTeams.length ? "De los equipos que sigues." : "No sigues equipos: ves los avisos de toda la liga."}
            actions={
              <button type="button" className="btn btn-sm" onClick={feed.reload}>
                Actualizar
              </button>
            }
          >
            {feed.data && feed.data.notifications.length > 0 ? (
              <ul className="notes">
                {feed.data.notifications.map((n) => (
                  <li key={n.id}>
                    <span className="meta">
                      {(KIND[n.type] ?? n.type) !== n.title && <span className="kind">{KIND[n.type] ?? n.type}</span>}
                      <time dateTime={n.createdAt}>
                        {new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                      </time>
                    </span>
                    <b>{n.title}</b>
                    <span>{n.body}</span>
                    {n.matchId && <Link href={`/partidos/${n.matchId}`}>Ver partido</Link>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">{feed.loading ? "Cargando..." : "Todavía no se ha enviado ningún aviso."}</p>
            )}
          </Card>

          <Card id="preferencias" title="Preferencias" hint="Notification Service: a quién seguir y por qué canal.">
            <fieldset className="checks">
              <legend>Equipos que sigo</legend>
              <div className="checks-scroll">
                {teams.map((t) => (
                  <label key={t.id}>
                    <input type="checkbox" checked={prefs.followedTeams.includes(t.id)} onChange={() => toggle("followedTeams", t.id)} />
                    {t.name} <small>{t.label}</small>
                  </label>
                ))}
                {teams.length === 0 && <p className="empty">No hay equipos registrados.</p>}
              </div>
            </fieldset>
            <fieldset className="checks mt-4">
              <legend>Canales</legend>
              {[
                ["push", "Push"],
                ["email", "Correo"],
              ].map(([v, label]) => (
                <label key={v}>
                  <input type="checkbox" checked={prefs.channels.includes(v)} onChange={() => toggle("channels", v)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="factions">
              <button
                type="button"
                className="btn btn-blue"
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(async () => {
                      await api("PUT", "/notifications/preferences", { userId: user.id, ...prefs });
                      return "Preferencias guardadas.";
                    })
                  ) {
                    setDraft(null);
                    feed.reload();
                  }
                }}
              >
                Guardar
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(async () => {
                      await api("POST", "/notifications/test", { userId: user.id });
                      return "Notificación de prueba enviada.";
                    })
                  )
                    feed.reload();
                }}
              >
                Enviar prueba
              </button>
            </div>
            <FormMessage message={message} />
          </Card>
        </div>
      </Page>
    </>
  );
}
