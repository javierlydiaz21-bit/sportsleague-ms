"use client";

import { Section } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import type { ServiceHealth } from "@/lib/types";

interface HealthReport {
  gateway: { status: string; database?: string; redis?: string };
  services: ServiceHealth[];
  timestamp: string;
}

const LABEL: Record<string, string> = { ok: "Activo", degraded: "Degradado" };

/**
 * Estado de los microservicios a traves del API Gateway. Solo se muestra en el panel
 * del organizador: es informacion tecnica, no para espectadores.
 */
export default function ServiceStatus() {
  const health = useApi<HealthReport>("/health/services");
  const services = health.data
    ? [{ key: "gateway", name: "API Gateway", latencyMs: 0, ...health.data.gateway }, ...health.data.services]
    : [];
  const down = services.filter((s) => s.status !== "ok").length;

  return (
    <Section
      id="estado"
      title="Estado del sistema"
      description={
        health.data
          ? down > 0
            ? `${down} servicio(s) sin responder. En el plan gratuito de Render tardan cerca de un minuto en despertar.`
            : `Los 9 servicios responden (consultado a las ${new Date(health.data.timestamp).toLocaleTimeString("es-CO")})`
          : "Consultando a los microservicios..."
      }
      actions={
        <button className="btn btn-ghost btn-sm" onClick={health.reload}>
          Actualizar
        </button>
      }
    >
      {health.error && <p className="text-sm text-error">{health.error}</p>}
      <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {services.map((s) => (
          <li key={s.key} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${s.status === "ok" ? "bg-ok" : "bg-error"}`} />
              <span className="font-semibold">{s.name}</span>
            </span>
            <span className={`text-xs ${s.status === "ok" ? "text-muted" : "text-error"}`}>
              {LABEL[s.status] ?? "Sin respuesta"}
              {s.status === "ok" && s.latencyMs ? ` · ${s.latencyMs} ms` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
