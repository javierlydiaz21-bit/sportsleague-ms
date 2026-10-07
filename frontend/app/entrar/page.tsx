import type { Metadata } from "next";
import AuthPage from "@/components/auth-page";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage() {
  return <AuthPage mode="entrar" />;
}
