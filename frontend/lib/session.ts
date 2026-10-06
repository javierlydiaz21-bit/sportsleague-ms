"use client";

import { useSyncExternalStore } from "react";
import { API_URL } from "./services";
import type { User } from "./types";

/**
 * Sesion del usuario (documento 10.1): access token JWT de corta duracion y refresh
 * token. Se guardan en el navegador y viajan en el header Authorization (no en
 * cookies), asi que un sitio ajeno no puede hacer peticiones en nombre del usuario.
 * Cuando el access token vence, se renueva solo con el refresh token.
 */
interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const STORAGE_KEY = "sportsleague.session";
const listeners = new Set<() => void>();
let current: Session | null | undefined;

function read(): Session | null {
  if (current === undefined) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      current = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      current = null;
    }
  }
  return current;
}

function write(session: Session | null) {
  current = session;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible: la sesion dura mientras la pagina este abierta */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(data: unknown, status: number): string {
  const msg = (data as { message?: string | string[] } | null)?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (msg) return msg;
  if (status === 0) return "Sin conexión con el API Gateway. Revisa que esté corriendo.";
  return `Error ${status}`;
}

async function request(method: string, path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return null;
  }
}

// Un solo refresh a la vez: el refresh token rota en cada uso.
let refreshing: Promise<Session | null> | null = null;

function refreshSession(): Promise<Session | null> {
  const session = read();
  if (!session) return Promise.resolve(null);
  refreshing ??= (async () => {
    const res = await request("POST", "/auth/refresh", { refreshToken: session.refreshToken });
    const next = res?.ok ? ((await res.json()) as Session) : null;
    write(next);
    return next;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Llamada al API Gateway con el token de la sesion; renueva el token si vencio. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await request(method, path, body, read()?.accessToken);
  if (res?.status === 401 && read()) {
    const renewed = await refreshSession();
    if (renewed) res = await request(method, path, body, renewed.accessToken);
  }
  if (!res) throw new ApiError(errorMessage(null, 0), 0);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status);
  return data as T;
}

export async function login(email: string, password: string): Promise<User> {
  const session = await api<Session>("POST", "/auth/login", { email, password });
  write(session);
  return session.user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const session = await api<Session>("POST", "/auth/register", { name, email, password });
  write(session);
  return session.user;
}

export async function logout() {
  const session = read();
  write(null);
  if (session) await request("POST", "/auth/logout", { refreshToken: session.refreshToken });
}

/** Token vigente para abrir el WebSocket u otras conexiones. */
export const accessToken = () => read()?.accessToken;

/** Usuario de la sesion. `ready` es false durante el primer render (en el servidor no hay sesion). */
export function useSession() {
  const session = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return { user: session?.user ?? null, ready };
}
