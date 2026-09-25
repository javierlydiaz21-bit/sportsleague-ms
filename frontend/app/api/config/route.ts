import { isConfigured, serviceUrl } from "@/lib/services";

// Se evalua en cada peticion: toma las URLs de Render de las variables de entorno de Vercel.
export const dynamic = "force-dynamic";

/** El panel (public/panel.html) consulta esta ruta para saber a que servicios conectarse. */
export function GET() {
  return Response.json({
    fixture: serviceUrl("fixture"),
    referee: serviceUrl("referee"),
    league: serviceUrl("league"),
    team: serviceUrl("team"),
    label: isConfigured() ? "Render" : "local (docker compose)",
  });
}
