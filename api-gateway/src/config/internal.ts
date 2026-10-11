/**
 * Token interno entre servicios: el gateway lo envia en cada llamada a un microservicio
 * (cabecera x-internal-token) y cada microservicio rechaza las llamadas que no lo traen
 * (src/security/internal-auth.ts de cada servicio). Viene de la variable de entorno
 * INTERNAL_TOKEN: no esta en el codigo ni llega al navegador, y es distinto del JWT.
 */
export const INTERNAL_HEADER = 'x-internal-token';

export function internalHeaders(): Record<string, string> {
  return { [INTERNAL_HEADER]: process.env.INTERNAL_TOKEN ?? '' };
}
