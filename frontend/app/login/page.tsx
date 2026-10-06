"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui";
import { login, register } from "@/lib/session";

const HOME_BY_ROLE = { organizador: "/organizador", arbitro: "/arbitro", espectador: "/notificaciones" };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = mode === "login" ? await login(email, password) : await register(name, email, password);
      router.push(HOME_BY_ROLE[user.role]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-4xl font-bold">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
      <p className="mt-1 text-muted">
        {mode === "login"
          ? "Organizadores, árbitros y espectadores registrados."
          : "Las cuentas nuevas son de espectador: sigue a tus equipos y recibe sus avisos."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-line bg-surface p-5">
        {mode === "register" && (
          <Field label="Nombre">
            <input className="field" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field label="Correo">
          <input
            className="field"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Contraseña" hint={mode === "register" ? "Mínimo 8 caracteres" : undefined}>
          <input
            className="field"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <button
          className="font-semibold text-sync hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Regístrate como espectador" : "Inicia sesión"}
        </button>
      </p>

      <details className="mt-6 rounded-lg border border-line p-4 text-sm text-muted">
        <summary className="cursor-pointer font-semibold text-ink">Cuentas de prueba (entorno local)</summary>
        <p className="mt-2">
          Organizador: <code>admin@sportsleague.co</code> / <code>admin12345</code>.
        </p>
        <p className="mt-1">
          Al cargar los datos de demostración desde el panel del organizador se crean los árbitros{" "}
          <code>arbitro1@sportsleague.co</code> y <code>arbitro2@sportsleague.co</code>, con contraseña{" "}
          <code>arbitro123</code>.
        </p>
      </details>
    </main>
  );
}
