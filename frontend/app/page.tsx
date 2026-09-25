import { connection } from "next/server";
import { SERVICES, getJson, isConfigured, serviceUrl } from "@/lib/services";

export default async function Home() {
  await connection(); // el estado de los servicios se consulta en cada visita
  const status = await Promise.all(
    SERVICES.map(async (s) => {
      const health = await getJson<{ status: string }>(`${serviceUrl(s.key)}/api/v1/health`);
      return { ...s, ok: health?.status === "ok" };
    }),
  );
  const down = status.filter((s) => !s.ok).length;

  return (
    <main className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-bold">SportsLeague</h1>
        <p className="mt-1 text-muted">Ligas deportivas amateur: calendario público y panel de organizadores.</p>
      </header>

      <section aria-labelledby="estado">
        <h2 id="estado" className="font-display text-2xl font-bold">Estado de los servicios</h2>
        <p className="mt-1 text-sm text-muted">
          Conectado a {isConfigured() ? "Render" : "los servicios locales (docker compose)"}.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status.map((s) => (
            <li key={s.key} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-display text-lg font-bold">{s.name}</p>
              <p className={`mt-1 flex items-center gap-2 text-sm ${s.ok ? "text-ok" : "text-error"}`}>
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${s.ok ? "bg-ok" : "bg-error"}`} />
                {s.ok ? "Activo" : "Sin respuesta"}
              </p>
            </li>
          ))}
        </ul>
        {down > 0 && (
          <p className="mt-3 text-sm text-async">
            En el plan gratuito de Render los servicios se duermen tras 15 minutos sin uso y tardan cerca de un
            minuto en despertar. Recarga esta página en un momento.
          </p>
        )}
      </section>

      <section aria-labelledby="calendario" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="calendario" className="font-display text-2xl font-bold">Calendario de una temporada</h2>
        <p className="mt-1 text-muted">Página pública generada en el servidor (SSR), lista para buscadores.</p>
        <form action="/calendario" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted">
            Id de la temporada
            <input
              name="temporada"
              type="number"
              min={1}
              defaultValue={1}
              required
              className="mt-1 block w-40 rounded-md border border-line bg-surface-2 px-3 py-2 text-ink"
            />
          </label>
          <button type="submit" className="rounded-md bg-sync px-4 py-2 font-semibold text-pitch hover:brightness-110">
            Ver calendario
          </button>
        </form>
      </section>

      <section aria-labelledby="panel" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="panel" className="font-display text-2xl font-bold">Panel de organizadores</h2>
        <p className="mt-1 text-muted">
          Crea la liga, los equipos y los árbitros, genera el calendario y mira cómo se comunican los
          microservicios en vivo.
        </p>
        <a
          href="/panel"
          className="mt-4 inline-block rounded-md bg-async px-4 py-2 font-semibold text-pitch hover:brightness-110"
        >
          Abrir el panel
        </a>
      </section>
    </main>
  );
}
