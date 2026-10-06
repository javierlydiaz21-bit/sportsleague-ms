"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/services";

const INTERVAL_MS = 4 * 60 * 1000;

/**
 * En el plan gratuito de Render cada servicio se duerme tras 15 minutos sin trafico
 * y tarda cerca de un minuto en despertar. Mientras la web este abierta, se consulta
 * el estado de los servicios cada 4 minutos: los despierta al entrar y los mantiene
 * activos solo mientras alguien la usa.
 */
export default function KeepAwake() {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_URL}/api/v1/health/services`).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
