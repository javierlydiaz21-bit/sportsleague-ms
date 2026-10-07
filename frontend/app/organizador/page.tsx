import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /inicio, como en el diseño. */
export default function OldRoute() {
  redirect("/inicio");
}
