import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /equipos, como en el diseño. */
export default function OldRoute() {
  redirect("/equipos");
}
