import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /partidos, como en el diseño. */
export default function OldRoute() {
  redirect("/partidos");
}
