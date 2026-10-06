"use client";

import { useState } from "react";
import { Field, Section } from "@/components/ui";
import { api } from "@/lib/session";
import { useAction, useApi } from "@/lib/use-api";
import type { League, Referee, User } from "@/lib/types";
import { ActionMessage, DAYS, DAY_LABELS, SubTitle, flatten } from "./shared";

export default function Referees({ leagues }: { leagues: League[] }) {
  const { categories } = flatten(leagues);
  const referees = useApi<Referee[]>("/referees");
  const users = useApi<User[]>("/auth/users");
  const { busy, message, run } = useAction();

  const [zone, setZone] = useState("monteria-norte");
  const [certified, setCertified] = useState<number[]>([]);
  const [days, setDays] = useState<string[]>(["sabado", "domingo"]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const accountOf = (refereeId: number) => users.data?.find((u) => u.refereeId === refereeId);
  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`;
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <Section
      id="arbitros"
      title="Árbitros"
      description="Referee Service: se asignan solos a los partidos según zona, categoría certificada y días disponibles."
    >
      {referees.error && <p className="text-sm text-error">{referees.error}</p>}
      {referees.data && referees.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Árbitro</th>
                <th className="py-2 pr-3 font-semibold">Zona</th>
                <th className="py-2 pr-3 font-semibold">Certificado en</th>
                <th className="py-2 pr-3 font-semibold">Disponible</th>
                <th className="py-2 pr-3 font-semibold">Asignaciones</th>
                <th className="py-2 font-semibold">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {referees.data.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 pr-3">#{r.id}</td>
                  <td className="py-2 pr-3">{r.zone}</td>
                  <td className="py-2 pr-3">{r.categoriesCertified.map(categoryName).join(", ")}</td>
                  <td className="py-2 pr-3">{r.availability.join(", ")}</td>
                  <td className="py-2 pr-3 tabular-nums">{r._count?.assignments ?? 0}</td>
                  <td className="py-2 text-muted">{accountOf(r.id)?.email ?? "sin cuenta"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No hay árbitros registrados.</p>
      )}

      <form
        className="mt-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(async () => {
            if (certified.length === 0) throw new Error("Marca al menos una categoría certificada.");
            if (days.length === 0) throw new Error("Marca al menos un día disponible.");
            const r = await api<Referee>("POST", "/referees", { zone, categoriesCertified: certified, availability: days });
            if (email) {
              await api("POST", "/auth/users", { name: name || `Árbitro ${r.id}`, email, password, role: "arbitro", refereeId: r.id });
              return `Árbitro #${r.id} registrado con la cuenta ${email}.`;
            }
            return `Árbitro #${r.id} registrado (sin cuenta de acceso).`;
          });
          if (ok) {
            setEmail("");
            setPassword("");
            setName("");
            referees.reload();
            users.reload();
          }
        }}
      >
        <SubTitle>Registrar árbitro</SubTitle>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Zona">
              <input className="field" required value={zone} onChange={(e) => setZone(e.target.value)} />
            </Field>
            <fieldset>
              <legend className="text-sm text-muted">Categorías certificadas</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={certified.includes(c.id)} onChange={() => setCertified(toggle(certified, c.id))} />
                    {c.league.name}, {c.name} <span className="text-xs text-muted">#{c.id}</span>
                  </label>
                ))}
                {categories.length === 0 && <span className="text-muted">Crea primero una categoría.</span>}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm text-muted">Días disponibles</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-2">
                    <input type="checkbox" checked={days.includes(d)} onChange={() => setDays(toggle(days, d))} />
                    {DAY_LABELS[i]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Cuenta de acceso (opcional): con ella el árbitro registra los eventos de sus partidos desde la app.
            </p>
            <Field label="Nombre">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Correo">
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres">
              <input
                className="field"
                type="password"
                minLength={8}
                required={Boolean(email)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <button className="btn btn-primary mt-3" disabled={busy}>
          Registrar árbitro
        </button>
        <ActionMessage message={message} />
      </form>
    </Section>
  );
}
