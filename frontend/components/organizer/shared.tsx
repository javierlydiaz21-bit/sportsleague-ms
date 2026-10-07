import { today as colombiaToday } from "@/lib/server-data";

export const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const DAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const dayNames = (list: string[]) => DAYS.filter((d) => list.includes(d)).map((d) => DAY_LABELS[DAYS.indexOf(d)]).join(", ");

/** Fecha de hoy en Colombia (YYYY-MM-DD). */
export const today = colombiaToday;
