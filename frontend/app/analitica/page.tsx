import { redirect } from "next/navigation";

/** La analítica ahora vive en la sección Estadísticas del panel. */
export default function AnaliticaPage() {
  redirect("/organizador/estadisticas");
}
