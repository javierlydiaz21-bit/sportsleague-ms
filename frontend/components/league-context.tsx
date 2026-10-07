"use client";

import { createContext, useContext, useState } from "react";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import type { League } from "@/lib/types";

/**
 * Liga activa del panel. El diseño trabaja con la liga de la cuenta; en el backend un
 * organizador administra todas, así que el panel muestra una a la vez (por defecto la
 * más reciente) y se cambia desde el menú de la cuenta.
 * League Service: GET /leagues (con sus temporadas, categorías y reglamento).
 */
interface LeagueState {
  leagues: League[] | null;
  league: League | null;
  error: string;
  setLeague: (id: number) => void;
  reload: () => void;
}

const KEY = "sportsleague.liga";
const LeagueContext = createContext<LeagueState>({ leagues: null, league: null, error: "", setLeague: () => {}, reload: () => {} });

function stored(): number | null {
  if (typeof window === "undefined") return null;
  try {
    return Number(window.localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const leagues = useApi<League[]>(user?.role === "organizador" ? "/leagues" : null);
  const [chosen, setChosen] = useState<number | null>(stored);
  const list = leagues.data;
  const league = list?.find((l) => l.id === chosen) ?? list?.reduce<League | null>((a, l) => (!a || l.id > a.id ? l : a), null) ?? null;

  const setLeague = (id: number) => {
    setChosen(id);
    try {
      window.localStorage.setItem(KEY, String(id));
    } catch {
      /* sin almacenamiento: la elección dura mientras la página esté abierta */
    }
  };

  return (
    <LeagueContext.Provider value={{ leagues: list, league, error: leagues.error, setLeague, reload: leagues.reload }}>
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => useContext(LeagueContext);
