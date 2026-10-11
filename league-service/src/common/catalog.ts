/** Deportes que admite la plataforma. */
export const SPORTS = ['futbol', 'basquet', 'voley'] as const;

/**
 * Criterios de desempate del reglamento: los mismos que reconoce el Statistics Service
 * al ordenar la tabla (statistics-service/src/stats/standings.util.ts).
 */
export const TIEBREAKERS = ['diferencia_de_goles', 'goles_a_favor', 'partidos_ganados'] as const;

/** Nombre comparable: sin tildes, sin mayusculas y sin espacios de sobra. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recorta los espacios de un texto recibido (para usar con @Transform). */
export const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Temporada coherente: inicio antes del fin (3.2) y año igual al de inicio o al de fin. Devuelve el error o null. */
export function seasonError(year: number, startDate: Date, endDate: Date): string | null {
  if (startDate >= endDate) return 'startDate debe ser anterior a endDate';
  if (year !== startDate.getUTCFullYear() && year !== endDate.getUTCFullYear()) {
    return 'year debe coincidir con el año de startDate o el de endDate';
  }
  return null;
}

/** Rango de edad "min-max" coherente (de 3 a 99 años, minimo <= maximo). Devuelve el error o null. */
export function ageRangeError(ageRange: string): string | null {
  const [min, max] = ageRange.split('-').map(Number);
  if (min > max) return 'En ageRange la edad minima no puede ser mayor que la maxima';
  if (min < 3) return 'En ageRange las edades deben estar entre 3 y 99 anios';
  return null;
}

/** Fecha (AAAA-MM-DD) de un instante o de una fecha de la base. */
export const dayOf = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
