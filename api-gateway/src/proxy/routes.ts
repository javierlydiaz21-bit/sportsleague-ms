import { ServiceKey } from '../config/services';

/**
 * Quien puede usar cada ruta (documento 5.2 y 10.2):
 *  - public: sin token (calendario, marcador, posiciones: la web publica de la liga).
 *  - auth: cualquier usuario autenticado.
 *  - organizador: solo organizadores.
 *  - own-referee: el arbitro dueno del id de la ruta, o un organizador.
 *  - own-assignment: el arbitro al que pertenece la asignacion, o un organizador.
 *  - assigned-referee: el arbitro asignado al partido de la ruta, o un organizador
 *    (un arbitro solo registra eventos de los partidos que tiene asignados).
 *  - own-user: el usuario del id de la ruta, o un organizador.
 *  - own-user-body: el usuario indicado en body.userId, o un organizador.
 */
export type Access =
  | 'public'
  | 'auth'
  | 'organizador'
  | 'own-referee'
  | 'own-assignment'
  | 'assigned-referee'
  | 'own-user'
  | 'own-user-body';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Ruta relativa a /api/v1. El primer grupo capturado es el id que usa la politica. */
  pattern: RegExp;
  service: ServiceKey;
  access: Access;
}

export const ROUTES: Route[] = [
  // League Service (2.2)
  { method: 'GET', pattern: /^\/leagues(?:\/\d+)?$/, service: 'league', access: 'public' },
  { method: 'POST', pattern: /^\/leagues$/, service: 'league', access: 'organizador' },
  { method: 'POST', pattern: /^\/leagues\/\d+\/seasons$/, service: 'league', access: 'organizador' },
  { method: 'POST', pattern: /^\/seasons\/\d+\/categories$/, service: 'league', access: 'organizador' },
  { method: 'GET', pattern: /^\/categories\/\d+(?:\/rules)?$/, service: 'league', access: 'public' },
  { method: 'PUT', pattern: /^\/categories\/\d+\/rules$/, service: 'league', access: 'organizador' },

  // Team Service (2.1)
  { method: 'GET', pattern: /^\/teams(?:\/\d+(?:\/players)?)?$/, service: 'team', access: 'public' },
  { method: 'POST', pattern: /^\/teams(?:\/\d+\/players)?$/, service: 'team', access: 'organizador' },
  { method: 'PUT', pattern: /^\/players\/\d+\/eligibility$/, service: 'team', access: 'organizador' },

  // Fixture Service (2.3)
  { method: 'POST', pattern: /^\/seasons\/\d+\/fixtures\/generate$/, service: 'fixture', access: 'organizador' },
  { method: 'GET', pattern: /^\/fixtures\/\d+$/, service: 'fixture', access: 'public' },
  { method: 'GET', pattern: /^\/matches\/\d+$/, service: 'fixture', access: 'public' },
  { method: 'PUT', pattern: /^\/matches\/\d+\/venue$/, service: 'fixture', access: 'organizador' },

  // Referee Service (2.4)
  { method: 'GET', pattern: /^\/referees$/, service: 'referee', access: 'organizador' },
  { method: 'POST', pattern: /^\/referees$/, service: 'referee', access: 'organizador' },
  { method: 'GET', pattern: /^\/referees\/(\d+)$/, service: 'referee', access: 'own-referee' },
  { method: 'PUT', pattern: /^\/referees\/(\d+)\/availability$/, service: 'referee', access: 'own-referee' },
  { method: 'GET', pattern: /^\/referees\/(\d+)\/assignments$/, service: 'referee', access: 'own-referee' },
  { method: 'PUT', pattern: /^\/assignments\/(\d+)\/confirm$/, service: 'referee', access: 'own-assignment' },

  // Live Score Service (2.5)
  { method: 'GET', pattern: /^\/matches\/\d+\/live$/, service: 'liveScore', access: 'public' },
  { method: 'GET', pattern: /^\/live-matches$/, service: 'liveScore', access: 'public' },
  { method: 'POST', pattern: /^\/matches\/(\d+)\/(?:events|complete|suspend)$/, service: 'liveScore', access: 'assigned-referee' },
  { method: 'DELETE', pattern: /^\/matches\/(\d+)\/events\/\d+$/, service: 'liveScore', access: 'assigned-referee' },

  // Statistics Service (2.6)
  { method: 'GET', pattern: /^\/(?:standings|top-scorers)\/\d+$/, service: 'statistics', access: 'public' },
  { method: 'GET', pattern: /^\/players\/\d+\/disciplinary-record$/, service: 'statistics', access: 'public' },
  { method: 'POST', pattern: /^\/standings\/\d+\/recalculate$/, service: 'statistics', access: 'organizador' },

  // Notification Service (2.7)
  { method: 'GET', pattern: /^\/notifications\/(\d+)$/, service: 'notification', access: 'own-user' },
  { method: 'PUT', pattern: /^\/notifications\/preferences$/, service: 'notification', access: 'own-user-body' },
  { method: 'POST', pattern: /^\/notifications\/test$/, service: 'notification', access: 'own-user-body' },

  // Analytics Service (2.8): panel de organizadores
  { method: 'GET', pattern: /^\/analytics\/.+$/, service: 'analytics', access: 'organizador' },
  { method: 'POST', pattern: /^\/analytics\/etl\/run$/, service: 'analytics', access: 'organizador' },
];

export interface MatchedRoute {
  route: Route;
  /** Id capturado por el patron (ej: el partido en /matches/{id}/events) */
  id?: number;
}

/** Busca la ruta para el metodo y la ruta (sin /api/v1 ni query string). */
export function matchRoute(method: string, path: string): MatchedRoute | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(path);
    if (m) return { route, id: m[1] !== undefined ? Number(m[1]) : undefined };
  }
  return null;
}

/** El partido al que se refiere una ruta, para la trazabilidad por match_id (9.1). */
export function matchIdOf(path: string): number | undefined {
  const m = /^\/matches\/(\d+)/.exec(path);
  return m ? Number(m[1]) : undefined;
}
