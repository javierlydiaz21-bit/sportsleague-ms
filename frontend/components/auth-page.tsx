"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Logo, Pitch } from "@/components/icons";
import { Field } from "@/components/ui";
import { login, register, useSession } from "@/lib/session";

const HOME_BY_ROLE = { organizador: "/organizador", arbitro: "/arbitro", espectador: "/notificaciones" };

/**
 * Acceso a SportsLeague, como en el diseño: primero "Crear cuenta" (/registro) y
 * luego "Iniciar sesión" (/login). Las cuentas nuevas son de espectador.
 */
export default function AuthPage({ mode }: { mode: "register" | "login" }) {
  const router = useRouter();
  const { user, ready } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  // Con la sesión abierta no hay nada que hacer aquí: se va a su página de inicio
  useEffect(() => {
    if (ready && user) router.replace(HOME_BY_ROLE[user.role]);
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isRegister && password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const u = isRegister ? await register(name.trim(), email.trim(), password) : await login(email.trim(), password);
      router.push(HOME_BY_ROLE[u.role]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="poster">
        <Pitch />
        <Link className="logo" href="/">
          <Logo />
          SportsLeague
        </Link>
        <h1>Tu liga, organizada de principio a fin.</h1>
        <p>Para ligas amateur de fútbol, básquet y vóley.</p>
        <ul className="feats">
          <li>
            <span className="feat">
              <Icon id="calendario" />
            </span>
            El calendario de la temporada se genera solo, respetando canchas y descanso.
          </li>
          <li>
            <span className="feat">
              <Icon id="arbitros" />
            </span>
            Cada partido recibe su árbitro según zona, categoría y disponibilidad.
          </li>
          <li>
            <span className="feat">
              <Icon id="estadisticas" />
            </span>
            Resultados, tabla de posiciones y goleadores al día para todos.
          </li>
        </ul>
        <Link className="demo-link" href="/">
          Ver los partidos y las tablas de las ligas
        </Link>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <nav className="pill-tabs" aria-label="Acceso">
            <Link href="/registro" aria-current={isRegister ? "page" : undefined}>
              Crear cuenta
            </Link>
            <Link href="/login" aria-current={isRegister ? undefined : "page"}>
              Iniciar sesión
            </Link>
          </nav>

          <div className="card">
            <h2>{isRegister ? "Crea tu cuenta" : "Inicia sesión"}</h2>
            <p className="hint">
              {isRegister
                ? "Sigue a tus equipos y recibe sus horarios, cambios de sede y resultados."
                : "Organizadores, árbitros y espectadores registrados."}
            </p>
            <form onSubmit={submit}>
              {isRegister && (
                <Field label="Tu nombre">
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field label="Correo">
                <input
                  type="email"
                  required
                  autoComplete={isRegister ? "email" : "username"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Contraseña" hint={isRegister ? "mínimo 8 caracteres" : undefined}>
                <input
                  type="password"
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {isRegister && (
                <Field label="Repite la contraseña">
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                  />
                </Field>
              )}
              <button type="submit" className="btn btn-blue btn-block" disabled={busy}>
                {busy ? "Un momento..." : isRegister ? "Crear cuenta" : "Entrar"}
              </button>
              {error && (
                <p role="alert" className="form-msg is-error">
                  {error}
                </p>
              )}
            </form>
          </div>

          <p className="alt">
            {isRegister ? (
              <>
                ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
              </>
            ) : (
              <>
                ¿No tienes cuenta? <Link href="/registro">Créala aquí</Link>
              </>
            )}
          </p>

          {!isRegister && (
            <details>
              <summary>Cuentas de prueba (entorno local)</summary>
              <p>
                Organizador: <code>admin@sportsleague.co</code> / <code>admin12345</code>.
              </p>
              <p>
                Al cargar los datos de ejemplo desde el panel del organizador se crean los árbitros{" "}
                <code>arbitro1@sportsleague.co</code> y <code>arbitro2@sportsleague.co</code>, con contraseña{" "}
                <code>arbitro123</code>.
              </p>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
