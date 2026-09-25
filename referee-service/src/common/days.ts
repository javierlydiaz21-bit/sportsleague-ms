/** Dias de la semana, en el orden de Date.getUTCDay() (0 = domingo). */
export const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export function dayOf(date: Date): string {
  return DAYS[date.getUTCDay()];
}
