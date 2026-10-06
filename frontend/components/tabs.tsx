"use client";

import { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Pestanas accesibles (teclado con flechas). El contenido puede venir del servidor. */
export default function Tabs({ tabs, initial }: { tabs: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0].id);

  const onKey = (e: React.KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    const next = tabs[(index + dir + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" className="scroll-x flex gap-6 border-b border-line px-4">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className="tab"
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
