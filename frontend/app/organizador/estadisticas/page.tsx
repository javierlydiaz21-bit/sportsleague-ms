import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /estadisticas, como en el diseño. */
export default function OldRoute() {
  redirect("/estadisticas");
}
