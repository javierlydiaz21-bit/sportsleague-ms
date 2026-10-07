import { redirect } from "next/navigation";

/** Ruta anterior del inicio de sesión: ahora es /entrar, como en el diseño. */
export default function LoginPage() {
  redirect("/entrar");
}
