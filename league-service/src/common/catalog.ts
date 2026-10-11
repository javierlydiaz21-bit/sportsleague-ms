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
