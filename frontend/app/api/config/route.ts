import { API_URL } from "@/lib/services";

// Se evalua en cada peticion.
export const dynamic = "force-dynamic";

/** El panel de pruebas (public/panel.html) consulta esta ruta para saber a que API Gateway conectarse. */
export function GET() {
  return Response.json({ gateway: API_URL });
}
