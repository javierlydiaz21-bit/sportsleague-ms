"use client";

import { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Pestañas accesibles (teclado con flechas). El contenido puede venir del servidor. */
export default function Tabs({ tabs, initial, label }: { tabs: TabItem[]; initial?: string; label?: string }) {
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
      <div role="tablist" aria-label={label} className="tabs">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
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
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          className="tab-panel"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
