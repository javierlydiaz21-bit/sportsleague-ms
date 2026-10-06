import Link from "next/link";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/services";
import type { MatchStatus } from "@/lib/types";

export function Section({
  title,
  description,
  children,
  id,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-2xl font-bold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" | "ok" }) {
  const cls = {
    muted: "border-line text-muted",
    error: "border-error/60 bg-error/10 text-error",
    ok: "border-ok/60 bg-ok/10 text-ok",
  }[tone];
  return <p className={`rounded-lg border p-4 text-sm ${cls}`}>{children}</p>;
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {status === "en_curso" && <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-live" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

/** Aviso para paginas que requieren sesion o un rol. */
export function LoginRequired({ role }: { role?: string }) {
  return (
    <Notice>
      {role ? `Esta sección es para ${role}. ` : "Esta sección requiere una cuenta. "}
      <Link href="/login" className="font-semibold text-sync hover:underline">
        Inicia sesión
      </Link>{" "}
      para continuar.
    </Notice>
  );
}
