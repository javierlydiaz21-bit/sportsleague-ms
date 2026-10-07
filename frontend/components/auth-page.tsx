"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Logo, Pitch } from "@/components/icons";
import { ApiError, login, register, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const HOME_BY_ROLE: Record<Role, string> = { organizador: "/inicio", arbitro: "/arbitro", espectador: "/notificaciones" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Acceso: crear cuenta (/registro) e iniciar sesión (/entrar), como en el diseño.
 * API Gateway: POST /auth/register y POST /auth/login entregan JWT + refresh token;
 * la contraseña se guarda solo como hash. Las cuentas nuevas son de espectador.
 */
export default function AuthPage({ mode }: { mode: "registro" | "entrar" }) {
  const router = useRouter();
  const { user, ready } = useSession();

  // Con la sesión abierta no hay nada que hacer aquí: se va a su página de inicio
  useEffect(() => {
    if (ready && user) router.replace(HOME_BY_ROLE[user.role]);
  }, [ready, user, router]);

  return (
    <div className="auth">
      <section className="poster">
        <Pitch />
        <Link className="logo" href="/registro">
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
        <Link className="demo-link" href="/publico">
          Ver el sitio de una liga de ejemplo
        </Link>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <nav className="pill-tabs" aria-label="Acceso">
            <Link href="/registro" aria-current={mode === "registro" ? "page" : undefined}>
              Crear cuenta
            </Link>
            <Link href="/entrar" aria-current={mode === "entrar" ? "page" : undefined}>
              Iniciar sesión
            </Link>
          </nav>
          {mode === "registro" ? (
            <SignUp onDone={(role) => router.push(HOME_BY_ROLE[role])} />
          ) : (
            <SignIn onDone={(role) => router.push(HOME_BY_ROLE[role])} />
          )}
        </div>
      </main>
    </div>
  );
}

/** Mensaje bajo el botón del formulario (vacío no se muestra). */
function FormMsg({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="form-msg is-error" role="alert">
      {text}
    </p>
  );
}

/** Crear cuenta. Mismas validaciones y mensajes del diseño, sin el grupo "Tu liga". */
function SignUp({ onDone }: { onDone: (role: Role) => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name")).trim();
    const email = String(fd.get("email")).trim().toLowerCase();
    const pass = String(fd.get("password"));
    const pass2 = String(fd.get("password2"));
    if (!name) return setMsg("Escribe tu nombre.");
    if (!EMAIL.test(email)) return setMsg("Escribe un correo válido, por ejemplo nombre@correo.com.");
    if (pass.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
    if (pass !== pass2) return setMsg("Las contraseñas no coinciden.");
    setMsg("");
    setBusy(true);
    try {
      // API Gateway: POST /auth/register (crea la cuenta y abre la sesión)
      const user = await register(name, email, pass);
      onDone(user.role);
    } catch (err) {
      setMsg(err instanceof ApiError && err.status === 409 ? "Ya existe una cuenta con ese correo. Inicia sesión." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Crea tu cuenta</h2>
        <p className="hint">Para quienes organizan ligas amateur.</p>
        <form noValidate onSubmit={submit}>
          <label className="fl">
            Tu nombre
            <input name="name" autoComplete="name" />
          </label>
          <label className="fl">
            Correo
            <input type="email" name="email" autoComplete="email" />
          </label>
          <label className="fl">
            Contraseña <small>mínimo 8 caracteres</small>
            <input type="password" name="password" autoComplete="new-password" />
          </label>
          <label className="fl">
            Repite la contraseña
            <input type="password" name="password2" autoComplete="new-password" />
          </label>
          <button className="btn btn-blue btn-block" type="submit" disabled={busy}>
            Crear cuenta
          </button>
          <FormMsg text={msg} />
        </form>
      </div>
      <p className="alt">
        ¿Ya tienes cuenta? <Link href="/entrar">Inicia sesión</Link>
      </p>
    </>
  );
}

// Cuenta de ejemplo del botón "Entrar con la cuenta de ejemplo". Por defecto, el
// organizador inicial del gateway en docker compose (ADMIN_EMAIL / ADMIN_PASSWORD).
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || "admin@sportsleague.co";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "admin12345";

/** Iniciar sesión. Mismas validaciones y mensajes del diseño. */
function SignIn({ onDone }: { onDone: (role: Role) => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function enter(email: string, pass: string) {
    setMsg("");
    setBusy(true);
    try {
      // API Gateway: POST /auth/login
      const user = await login(email, pass);
      onDone(user.role);
    } catch (err) {
      // El gateway responde igual si el correo no existe o si la contraseña no coincide
      setMsg(err instanceof ApiError && err.status === 401 ? "Correo o contraseña incorrectos." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const pass = String(fd.get("password"));
    if (!email || !pass) return setMsg("Escribe tu correo y tu contraseña.");
    enter(email, pass);
  }

  return (
    <>
      <div className="card">
        <h2>Inicia sesión</h2>
        <p className="hint">Entra al panel de tu liga.</p>
        <form noValidate onSubmit={submit}>
          <label className="fl">
            Correo
            <input type="email" name="email" autoComplete="username" />
          </label>
          <label className="fl">
            Contraseña
            <input type="password" name="password" autoComplete="current-password" />
          </label>
          <button className="btn btn-blue btn-block" type="submit" disabled={busy}>
            Entrar
          </button>
          <FormMsg text={msg} />
        </form>
        <div className="factions">
          <button className="btn btn-green btn-block" type="button" disabled={busy} onClick={() => enter(DEMO_EMAIL, DEMO_PASSWORD)}>
            Entrar con la cuenta de ejemplo
          </button>
        </div>
      </div>
      <p className="alt">
        ¿No tienes cuenta? <Link href="/registro">Créala aquí</Link>
      </p>
    </>
  );
}
