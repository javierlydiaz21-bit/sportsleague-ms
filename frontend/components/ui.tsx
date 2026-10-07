import Link from "next/link";
import { Icon, Pitch, type IconId } from "@/components/icons";
import { STATUS_LABEL } from "@/lib/services";
import type { MatchStatus } from "@/lib/types";

/** Banda en azul tinta con la cancha en trazo fino: el encabezado de cada página. */
export function Band({
  icon,
  title,
  intro,
  children,
}: {
  icon?: IconId;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="band">
      <Pitch />
      <div className="wrap">
        {icon && (
          <span className="band-icon" aria-hidden>
            <Icon id={icon} />
          </span>
        )}
        <div className="band-text">
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
        {children && <div className="band-aside">{children}</div>}
      </div>
    </section>
  );
}

/** Contenido de la página, debajo de la banda. */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <div className="wrap stack">{children}</div>
    </main>
  );
}

export function Card({
  title,
  hint,
  actions,
  children,
  id,
  className = "",
}: {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={`card ${className}`}>
      {(title || actions) && (
        <div className="head">
          <div>
            {title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}
            {hint && <p className="hint">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" | "ok" }) {
  const cls = { muted: "is-muted", error: "is-error", ok: "" }[tone];
  return (
    <p className={`flash ${cls}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

/** Resultado de un formulario, debajo de su botón. */
export function FormMessage({ message }: { message: { tone: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.tone === "error" ? "alert" : "status"} className={`form-msg is-${message.tone}`}>
      {message.text}
    </p>
  );
}

export function StatusChip({ status }: { status: MatchStatus }) {
  return (
    <span className={`chip chip-${status}`}>
      {status === "en_curso" && <i aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`fl ${className ?? ""}`}>
      <span>
        {label} {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

export function EmptyCard({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) {
  return (
    <Card title={title} hint={text}>
      {href && (
        <div className="factions">
          <Link className="btn btn-blue" href={href}>
            {label}
          </Link>
        </div>
      )}
    </Card>
  );
}

/** Aviso para páginas que requieren sesión o un rol. */
export function LoginRequired({ role }: { role?: string }) {
  return (
    <Page>
      <EmptyCard
        title={role ? `Esta sección es para ${role}` : "Esta sección requiere una cuenta"}
        text="Inicia sesión para continuar."
        href="/entrar"
        label="Iniciar sesión"
      />
    </Page>
  );
}
