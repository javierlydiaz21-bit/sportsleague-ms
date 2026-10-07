import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /ligas, como en el diseño. */
export default function OldRoute() {
  redirect("/ligas");
}
