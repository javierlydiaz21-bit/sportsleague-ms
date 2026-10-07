import { redirect } from "next/navigation";

/** Ruta anterior del panel: ahora es /calendario, como en el diseño. */
export default function OldRoute() {
  redirect("/calendario");
}
