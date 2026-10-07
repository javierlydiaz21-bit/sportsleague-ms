import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /arbitros, como en el diseño. */
export default function OldRoute() {
  redirect("/arbitros");
}
