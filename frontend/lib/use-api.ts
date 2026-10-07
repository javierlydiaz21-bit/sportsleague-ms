"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./session";

/**
 * GET al API Gateway desde un componente cliente. `reload()` vuelve a consultar.
 * Con path null no consulta (por ejemplo, mientras no hay sesion).
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ path: string | null; data: T | null; error: string }>({
    path: null,
    data: null,
    error: "",
  });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>("GET", path)
      .then((data) => {
        if (!cancelled) setResult({ path, data, error: "" });
      })
      .catch((err: Error) => {
        if (!cancelled) setResult({ path, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const fresh = result.path === path;
  return {
    data: fresh ? result.data : null,
    error: fresh ? result.error : "",
    loading: Boolean(path) && !fresh,
    reload,
  };
}

/**
 * Como useApi, pero con una carga propia que junta varias consultas. `key` identifica
 * los datos: al cambiar se vuelve a cargar. Con key null no carga.
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: string }>({
    key: null,
    data: null,
    error: "",
  });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: "" });
      })
      .catch((err: Error) => {
        if (!cancelled) setResult({ key, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
    // `load` cambia en cada render; los datos que usa quedan descritos por `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const fresh = result.key === key;
  return {
    data: fresh ? result.data : null,
    error: fresh ? result.error : "",
    loading: Boolean(key) && !fresh,
    reload,
  };
}

/** Ejecuta una accion mostrando su resultado; evita dobles envios. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const run = useCallback(async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: "ok", text: await action() });
      return true;
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, message, run };
}
