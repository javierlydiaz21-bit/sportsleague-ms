import Link from "next/link";
import { connection } from "next/server";
import { Notice, Section } from "@/components/ui";
import { teamName, teamsById } from "@/lib/server-data";
import { API_URL, getJson, utcDate } from "@/lib/services";
import type { League, LiveMatch, ServiceHealth } from "@/lib/types";

interface HealthReport {
  gateway: { status: string };
  services: ServiceHealth[];
}

const SPORT_LABEL: Record<string, string> = { futbol: "Fútbol", basquet: "Básquet", voley: "Vóley" };

export default async function Home() {
  await connection(); // datos actuales en cada visita
  const [allLeagues, live, health] = await Promise.all([
    getJson<League[]>("/leagues"),
    getJson<LiveMatch[]>("/live-matches?status=en_curso"),
    getJson<HealthReport>("/health/services", 12000),
  ]);
  // Las ligas mas recientes primero
  const leagues = allLeagues && [...allLeagues].sort((a, b) => b.id - a.id);
  const teams = await teamsById((live ?? []).flatMap((m) => [m.homeTeam, m.awayTeam]));
  const services = health ? [{ key: "gateway", name: "API Gateway", status: health.gateway.status }, ...health.services] : [];
  const down = services.filter((s) => s.status !== "ok").length;

  return (
    <main className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Ligas deportivas amateur</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Calendario de partidos, marcador en vivo y tabla de posiciones de cada temporada. Los organizadores programan
          la liga y los árbitros registran los goles y tarjetas desde la cancha.
        </p>
      </header>

      {health === null && (
        <Notice tone="error">
          No hay conexión con el API Gateway ({API_URL}). Si usas Docker, revisa que <code>docker compose up</code> esté
          corriendo; en Render los servicios gratuitos tardan cerca de un minuto en despertar.
        </Notice>
      )}

      <Section
        id="en-vivo"
        title="En vivo ahora"
        description="El marcador se actualiza al instante por WebSocket mientras el árbitro registra los eventos."
      >
        {live && live.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((m) => (
              <li key={m.matchId}>
                <Link
                  href={`/partidos/${m.matchId}`}
                  className="block rounded-lg border border-live/50 bg-surface-2 p-4 hover:border-live"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-live">
                    <span aria-hidden className="live-dot h-2 w-2 rounded-full bg-live" /> EN VIVO
                  </span>
                  <span className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-display text-xl font-bold">
                    <span>{teamName(teams, m.homeTeam)}</span>
                    <span className="tabular-nums">{m.score.home}</span>
                    <span>{teamName(teams, m.awayTeam)}</span>
                    <span className="tabular-nums">{m.score.away}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No hay partidos en juego en este momento.</p>
        )}
      </Section>

      <Section id="ligas" title="Ligas y temporadas" description="Elige una temporada para ver su calendario y posiciones.">
        {leagues && leagues.length > 0 ? (
          <div className="space-y-5">
            {leagues.map((league) => (
              <div key={league.id}>
                <h3 className="font-display text-xl font-bold">
                  {league.name} <span className="text-base font-semibold text-muted">· {SPORT_LABEL[league.sport] ?? league.sport}</span>
                </h3>
                {league.categories.length > 0 && (
                  <p className="text-sm text-muted">
                    Categorías: {league.categories.map((c) => `${c.name} (${c.ageRange} años)`).join(", ")}
                  </p>
                )}
                <ul className="mt-2 flex flex-wrap gap-2">
                  {league.seasons.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/temporadas/${s.id}`}
                        className="inline-block rounded-md border border-line bg-surface-2 px-3 py-2 text-sm hover:border-sync"
                      >
                        <span className="font-semibold">Temporada {s.year}</span>
                        <span className="block text-xs text-muted">
                          {utcDate(s.startDate)} a {utcDate(s.endDate)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {league.seasons.length === 0 && <li className="text-sm text-muted">Sin temporadas todavía.</li>}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Todavía no hay ligas. Un organizador puede crearlas, o cargar datos de ejemplo, desde el{" "}
            <Link href="/organizador" className="text-sync hover:underline">
              panel de organizadores
            </Link>
            .
          </p>
        )}
      </Section>

      {health && (
        <Section
          id="estado"
          title="Estado de los servicios"
          description={
            down > 0
              ? `${down} servicio(s) sin responder. En el plan gratuito de Render tardan cerca de un minuto en despertar.`
              : "Todos los microservicios responden a través del API Gateway."
          }
        >
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {services.map((s) => (
              <li key={s.key} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${s.status === "ok" ? "bg-ok" : "bg-error"}`} />
                  <span className="font-semibold">{s.name}</span>
                </span>
                <span className={`text-xs ${s.status === "ok" ? "text-muted" : "text-error"}`}>
                  {s.status === "ok" ? "Activo" : s.status === "degraded" ? "Degradado" : "Sin respuesta"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </main>
  );
}
