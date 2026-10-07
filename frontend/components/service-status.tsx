"use client";

import { Card } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import type { ServiceHealth } from "@/lib/types";

interface HealthReport {
  gateway: { status: string; database?: string; redis?: string };
  services: ServiceHealth[];
  timestamp: string;
}

const LABEL: Record<string, string> = { ok: "Activo", degraded: "Degradado" };

/**
 * Estado de los microservicios a través del API Gateway. Solo se muestra en el panel
 * del organizador: es información técnica, no para espectadores.
 */
export default function ServiceStatus() {
  const health = useApi<HealthReport>("/health/services");
  const services = health.data
    ? [{ key: "gateway", name: "API Gateway", latencyMs: 0, ...health.data.gateway }, ...health.data.services]
    : [];
  const down = services.filter((s) => s.status !== "ok").length;

  return (
    <Card
      id="estado"
      title="Estado del sistema"
      hint={
        health.data
          ? down > 0
            ? `${down} servicio(s) sin responder. En el plan gratuito de Render tardan cerca de un minuto en despertar.`
            : `Los ${services.length} servicios responden (consultado a las ${new Date(health.data.timestamp).toLocaleTimeString("es-CO")}).`
          : "Consultando a los microservicios..."
      }
      actions={
        <button type="button" className="btn btn-sm" onClick={health.reload}>
          Actualizar
        </button>
      }
    >
      {health.error && <p className="form-msg is-error">{health.error}</p>}
      {services.length > 0 && (
        <ul className="svc">
          {services.map((s) => (
            <li key={s.key}>
              <b>
                <span aria-hidden className={`dot${s.status === "ok" ? "" : " off"}`} />
                {s.name}
              </b>
              <span className={s.status === "ok" ? undefined : "down"}>
                {LABEL[s.status] ?? "Sin respuesta"}
                {s.status === "ok" && s.latencyMs ? `, ${s.latencyMs} ms` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
