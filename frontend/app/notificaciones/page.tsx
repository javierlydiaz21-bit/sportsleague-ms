"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginRequired, Notice, Section } from "@/components/ui";
import { api, useSession } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, NotificationFeed, Team } from "@/lib/types";

const TYPE_STYLE: Record<string, string> = {
  horario_confirmado: "border-sync",
  cambio_de_sede: "border-async",
  resultado_final: "border-ok",
  partido_suspendido: "border-error",
  prueba: "border-line",
};

export default function NotificationsPage() {
  const { user, ready } = useSession();
  const feed = useApi<NotificationFeed>(user ? `/notifications/${user.id}` : null);
  const leagues = useApi<League[]>(user ? "/leagues" : null);
  const [teams, setTeams] = useState<Array<Team & { label: string }>>([]);
  const { busy, message, run } = useAction();
  const [draft, setDraft] = useState<{ followedTeams: number[]; channels: string[] } | null>(null);
  const prefs = draft ?? feed.data?.preferences ?? { followedTeams: [], channels: [] };

  // Equipos de todas las categorias, para elegir a cuales seguir
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

  // Los avisos llegan por eventos; se consulta de nuevo cada 15 s mientras la pagina esta abierta
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
    <main className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold">Notificaciones</h1>
        <p className="mt-1 text-muted">
          Horarios confirmados, cambios de sede, resultados finales y suspensiones de los equipos que sigues.
        </p>
      </header>
      {feed.error && <Notice tone="error">{feed.error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Section
          id="avisos"
          title="Avisos"
          description={prefs.followedTeams.length ? "De los equipos que sigues." : "No sigues equipos: ves los avisos de toda la liga."}
          actions={
            <button className="btn btn-ghost btn-sm" onClick={feed.reload}>
              Actualizar
            </button>
          }
        >
          {feed.data && feed.data.notifications.length > 0 ? (
            <ul className="space-y-2">
              {feed.data.notifications.map((n) => (
                <li key={n.id} className={`rounded-md border-l-4 bg-surface-2 px-3 py-2 text-sm ${TYPE_STYLE[n.type] ?? "border-line"}`}>
                  <p className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">{n.title}</span>
                    <time className="text-xs text-muted" dateTime={n.createdAt}>
                      {new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </p>
                  <p className="text-muted">{n.body}</p>
                  {n.matchId && (
                    <Link href={`/partidos/${n.matchId}`} className="text-xs text-sync hover:underline">
                      Ver partido
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{feed.loading ? "Cargando..." : "Todavía no hay avisos."}</p>
          )}
        </Section>

        <Section id="preferencias" title="Preferencias" description="Notification Service: a quién seguir y por qué canal.">
          <fieldset>
            <legend className="text-sm text-muted">Equipos que sigo</legend>
            <div className="mt-1 max-h-64 space-y-1 overflow-y-auto text-sm">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.followedTeams.includes(t.id)} onChange={() => toggle("followedTeams", t.id)} />
                  {t.name} <span className="text-xs text-muted">{t.label}</span>
                </label>
              ))}
              {teams.length === 0 && <p className="text-muted">No hay equipos registrados.</p>}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-sm text-muted">Canales</legend>
            <div className="mt-1 flex gap-4 text-sm">
              {[
                ["push", "Push"],
                ["email", "Correo"],
              ].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.channels.includes(v)} onChange={() => toggle("channels", v)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
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
              className="btn btn-ghost"
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
          {message && <p className={`mt-2 text-sm ${message.tone === "ok" ? "text-ok" : "text-error"}`}>{message.text}</p>}
        </Section>
      </div>
    </main>
  );
}
