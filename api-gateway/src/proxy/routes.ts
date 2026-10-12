import { ServiceKey } from '../config/services';

/**
 * Quien puede usar cada ruta (documento 5.2 y 10.2):
 *  - public: sin token (calendario, marcador, posiciones: la web publica de la liga).
 *  - auth: cualquier usuario autenticado.
 *  - organizador: cualquier organizador (por ejemplo, crear su propia liga o ver sus ligas).
 *  - admin-assign-owner: solo el administrador de la plataforma, y el propietario nuevo debe ser organizador.
 *  - owner-*: solo el organizador propietario de la liga a la que pertenece el recurso; si la
 *    liga aun no tiene propietario, solo el administrador de la plataforma. El sufijo dice como
 *    se llega a la liga: league (id de la ruta), season, category, team, player, match (id de
 *    la ruta), category-body (body.categoryId) y referee-body (body.categoriesCertified).
 *  - own-referee: el arbitro dueno del id de la ruta, o un organizador (solo lectura).
 *  - own-referee-or-owner: el arbitro dueno del id, o el organizador propietario de todas sus categorias.
 *  - own-assignment: el arbitro al que pertenece la asignacion, o un organizador.
 *  - assigned-referee: el arbitro asignado al partido de la ruta, o el organizador propietario
 *    de la liga del partido (un arbitro solo registra eventos de los partidos que tiene asignados).
 *  - own-user / own-user-body: solo el mismo usuario (o el administrador de la plataforma).
 */
export type Access =
  | 'public'
  | 'auth'
  | 'organizador'
  | 'admin-assign-owner'
  | 'owner-league'
  | 'owner-season'
  | 'owner-category'
  | 'owner-category-body'
  | 'owner-team'
  | 'owner-player'
  | 'owner-match'
  | 'owner-referee-body'
  | 'own-referee'
  | 'own-referee-or-owner'
  | 'own-assignment'
  | 'assigned-referee'
  | 'own-user'
  | 'own-user-body';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Ruta relativa a /api/v1. El primer grupo capturado es el id que usa la politica. */
  pattern: RegExp;
  service: ServiceKey;
  access: Access;
}

export const ROUTES: Route[] = [
  // League Service (2.2)
  { method: 'GET', pattern: /^\/leagues(?:\/\d+)?$/, service: 'league', access: 'public' },
  // "Mis ligas": el gateway reenvia x-user-id y el League Service filtra por propietario
  { method: 'GET', pattern: /^\/leagues\/mine$/, service: 'league', access: 'organizador' },
  { method: 'POST', pattern: /^\/leagues$/, service: 'league', access: 'organizador' },
  { method: 'POST', pattern: /^\/leagues\/(\d+)\/seasons$/, service: 'league', access: 'owner-league' },
  { method: 'POST', pattern: /^\/seasons\/(\d+)\/categories$/, service: 'league', access: 'owner-season' },
  { method: 'GET', pattern: /^\/categories\/\d+(?:\/rules)?$/, service: 'league', access: 'public' },
  { method: 'PUT', pattern: /^\/categories\/(\d+)\/rules$/, service: 'league', access: 'owner-category' },
  // Correccion de liga, temporada y categoria (el League Service tambien valida el propietario)
  { method: 'PATCH', pattern: /^\/leagues\/(\d+)$/, service: 'league', access: 'owner-league' },
  { method: 'PATCH', pattern: /^\/seasons\/(\d+)$/, service: 'league', access: 'owner-season' },
  { method: 'PATCH', pattern: /^\/categories\/(\d+)$/, service: 'league', access: 'owner-category' },
  // Asignacion del propietario de una liga sin propietario: solo el administrador de la plataforma
  { method: 'PUT', pattern: /^\/leagues\/(\d+)\/owner$/, service: 'league', access: 'admin-assign-owner' },

  // Team Service (2.1)
  // Elegibilidad de una categoria al corregir su rango de edad: vista previa y recalculo
  { method: 'GET', pattern: /^\/categories\/(\d+)\/eligibility-preview$/, service: 'team', access: 'owner-category' },
  { method: 'POST', pattern: /^\/categories\/(\d+)\/eligibility\/recalculate$/, service: 'team', access: 'owner-category' },
  { method: 'GET', pattern: /^\/teams(?:\/\d+(?:\/players)?)?$/, service: 'team', access: 'public' },
  { method: 'POST', pattern: /^\/teams$/, service: 'team', access: 'owner-category-body' },
  { method: 'POST', pattern: /^\/teams\/(\d+)\/players$/, service: 'team', access: 'owner-team' },
  { method: 'PUT', pattern: /^\/players\/(\d+)\/eligibility$/, service: 'team', access: 'owner-player' },

  // Fixture Service (2.3)
  { method: 'POST', pattern: /^\/seasons\/(\d+)\/fixtures\/generate$/, service: 'fixture', access: 'owner-season' },
  { method: 'GET', pattern: /^\/fixtures\/\d+$/, service: 'fixture', access: 'public' },
  { method: 'GET', pattern: /^\/matches\/\d+$/, service: 'fixture', access: 'public' },
  { method: 'PUT', pattern: /^\/matches\/(\d+)\/venue$/, service: 'fixture', access: 'owner-match' },

  // Referee Service (2.4)
  { method: 'GET', pattern: /^\/referees$/, service: 'referee', access: 'organizador' },
  { method: 'POST', pattern: /^\/referees$/, service: 'referee', access: 'owner-referee-body' },
  { method: 'GET', pattern: /^\/referees\/(\d+)$/, service: 'referee', access: 'own-referee' },
  { method: 'PUT', pattern: /^\/referees\/(\d+)\/availability$/, service: 'referee', access: 'own-referee-or-owner' },
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
  { method: 'POST', pattern: /^\/standings\/(\d+)\/recalculate$/, service: 'statistics', access: 'owner-season' },

  // Notification Service (2.7)
  { method: 'GET', pattern: /^\/notifications\/(\d+)$/, service: 'notification', access: 'own-user' },
  { method: 'PUT', pattern: /^\/notifications\/preferences$/, service: 'notification', access: 'own-user-body' },
  { method: 'POST', pattern: /^\/notifications\/test$/, service: 'notification', access: 'own-user-body' },

  // Analytics Service (2.8): panel de organizadores (indicadores agregados; el ETL es global)
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
