import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OwnershipService } from '../ownership/ownership.service';
import { AccessService } from './access.service';
import { matchRoute } from './routes';

const user = (role: string, extra: any = {}) => ({ sub: 5, email: 'x@x.co', name: 'X', role, refereeId: null, ...extra });
const arbitro = user('arbitro', { refereeId: 2 });
// Organizador 5 (propietario de la liga 1), otro organizador 6 y el administrador de la plataforma
const owner = user('organizador');
const other = user('organizador', { sub: 6, email: 'otra@liga.co' });
const admin = user('organizador', { sub: 1, email: 'admin@sportsleague.co' });

/**
 * Datos de propiedad simulados: liga 1 del organizador 5 (temporada 3, categoria 4, equipo 7,
 * jugador 8, partido 11, arbitro 2) y liga 2 sin propietario (temporada 30, categoria 40, partido 99).
 */
function build(assignments: any[] = [{ id: 7, matchId: 11 }]) {
  const owners: Record<string, any> = {
    'leagues:1': { leagueId: 1, ownerId: 5 },
    'seasons:3': { leagueId: 1, ownerId: 5 },
    'categories:4': { leagueId: 1, ownerId: 5 },
    'leagues:2': { leagueId: 2, ownerId: null },
    'seasons:30': { leagueId: 2, ownerId: null },
    'categories:40': { leagueId: 2, ownerId: null },
  };
  const service = new OwnershipService();
  jest.spyOn(service, 'league').mockImplementation(async (kind, id) => {
    const o = owners[`${kind}:${id}`];
    if (!o) throw new NotFoundException(`No existe ${kind} ${id}`);
    return o;
  });
  jest.spyOn(service, 'categories').mockImplementation(async (ids) => ids.map((id) => ({ categoryId: id, ...owners[`categories:${id}`] })));
  jest.spyOn(service, 'teamCategory').mockResolvedValue(4);
  jest.spyOn(service, 'playerCategory').mockResolvedValue(4);
  jest.spyOn(service, 'matchSeason').mockImplementation(async (id) => (id === 99 ? 30 : 3));
  jest.spyOn(service, 'refereeCategories').mockResolvedValue([4]);
  jest.spyOn(service, 'assignmentMatch').mockImplementation(async (id) => (id === 70 ? 99 : 11));
  const prisma: any = { user: { findUnique: jest.fn(async ({ where }) => ({ 5: { id: 5, role: 'organizador' }, 20: { id: 20, role: 'espectador' } })[where.id] ?? null) } };
  const access = new AccessService(service, prisma);
  jest.spyOn(access, 'assignmentsOf').mockResolvedValue(assignments);
  return access;
}

const route = (method: string, path: string) => {
  const m = matchRoute(method, path);
  if (!m) throw new Error(`sin ruta para ${method} ${path}`);
  return m;
};

describe('matchRoute (enrutamiento del gateway)', () => {
  it.each([
    ['GET', '/matches/3', 'fixture'],
    ['GET', '/matches/3/live', 'liveScore'],
    ['POST', '/matches/3/events', 'liveScore'],
    ['POST', '/seasons/1/categories', 'league'],
    ['POST', '/seasons/1/fixtures/generate', 'fixture'],
    ['PUT', '/players/4/eligibility', 'team'],
    ['GET', '/players/4/disciplinary-record', 'statistics'],
    ['GET', '/standings/1', 'statistics'],
    ['GET', '/notifications/5', 'notification'],
    ['GET', '/analytics/summary', 'analytics'],
    ['PUT', '/leagues/1/owner', 'league'],
  ])('%s %s va al servicio %s', (method, path, service) => {
    expect(route(method, path).route.service).toBe(service);
  });

  it('captura el id del recurso para la politica', () => {
    expect(route('POST', '/matches/42/complete').id).toBe(42);
    expect(route('DELETE', '/matches/42/events/9').id).toBe(42);
    expect(route('POST', '/teams/7/players').id).toBe(7);
    expect(route('POST', '/teams').route.access).toBe('owner-category-body');
  });

  it('no enruta metodos o rutas desconocidas (las consultas internas de propiedad no son publicas)', () => {
    expect(matchRoute('DELETE', '/leagues/1')).toBeNull();
    expect(matchRoute('GET', '/secreto')).toBeNull();
    expect(matchRoute('GET', '/ownership/leagues/1')).toBeNull();
    expect(matchRoute('GET', '/players/8')).toBeNull();
    expect(matchRoute('GET', '/assignments/7')).toBeNull();
  });
});

describe('AccessService.authorize (permisos diferenciados, 10.2)', () => {
  it('las rutas publicas no piden token', async () => {
    await expect(build().authorize(route('GET', '/standings/1'), null, {})).resolves.toBeUndefined();
  });

  it('sin token responde 401 en una ruta protegida', async () => {
    await expect(build().authorize(route('POST', '/leagues'), null, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un espectador no puede crear ligas ni modificar ligas (403)', async () => {
    await expect(build().authorize(route('POST', '/leagues'), user('espectador'), {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().authorize(route('POST', '/leagues/1/seasons'), user('espectador'), {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cualquier organizador crea su propia liga y ve sus ligas', async () => {
    await expect(build().authorize(route('POST', '/leagues'), other, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('GET', '/leagues/mine'), other, {})).resolves.toBeUndefined();
  });
});

describe('Propiedad de las ligas en todas las escrituras', () => {
  const writes: [string, string, any][] = [
    ['POST', '/leagues/1/seasons', {}],
    ['PATCH', '/leagues/1', {}],
    ['POST', '/seasons/3/categories', {}],
    ['PATCH', '/seasons/3', {}],
    ['POST', '/seasons/3/fixtures/generate', {}],
    ['POST', '/standings/3/recalculate', {}],
    ['PUT', '/categories/4/rules', {}],
    ['PATCH', '/categories/4', {}],
    ['GET', '/categories/4/eligibility-preview', {}],
    ['POST', '/categories/4/eligibility/recalculate', {}],
    ['POST', '/teams', { categoryId: 4 }],
    ['POST', '/teams/7/players', {}],
    ['PUT', '/players/8/eligibility', {}],
    ['PUT', '/matches/11/venue', {}],
    ['POST', '/matches/11/events', {}],
    ['DELETE', '/matches/11/events/5', {}],
    ['POST', '/referees', { categoriesCertified: [4] }],
    ['PUT', '/referees/2/availability', {}],
    ['PUT', '/assignments/7/confirm', {}],
  ];

  it.each(writes)('el propietario puede: %s %s', async (method, path, body) => {
    await expect(build().authorize(route(method, path), owner, body)).resolves.toBeUndefined();
  });

  it.each(writes)('otro organizador recibe 403: %s %s', async (method, path, body) => {
    await expect(build().authorize(route(method, path), other, body)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('en una liga sin propietario solo el administrador de la plataforma puede escribir', async () => {
    for (const [method, path, body] of [
      ['POST', '/leagues/2/seasons', {}],
      ['PUT', '/categories/40/rules', {}],
      ['POST', '/teams', { categoryId: 40 }],
      ['POST', '/matches/99/events', {}],
      ['PUT', '/assignments/70/confirm', {}],
    ] as [string, string, any][]) {
      await expect(build().authorize(route(method, path), owner, body)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(build().authorize(route(method, path), admin, body)).resolves.toBeUndefined();
    }
  });

  it('el administrador no escribe en una liga que ya tiene propietario', async () => {
    await expect(build().authorize(route('POST', '/leagues/1/seasons'), admin, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un arbitro registra eventos solo en los partidos que tiene asignados', async () => {
    await expect(build().authorize(route('POST', '/matches/11/events'), arbitro, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('POST', '/matches/12/events'), arbitro, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un arbitro cambia su propia disponibilidad, no la de otro', async () => {
    await expect(build().authorize(route('PUT', '/referees/2/availability'), arbitro, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('PUT', '/referees/3/availability'), arbitro, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('datos invalidos o recursos inexistentes no pasan la autorizacion', async () => {
    await expect(build().authorize(route('POST', '/teams'), owner, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().authorize(route('POST', '/referees'), owner, { categoriesCertified: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().authorize(route('POST', '/leagues/77/seasons'), owner, {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Asignacion de propietario (administrador de la plataforma)', () => {
  it('solo el administrador asigna, y el propietario nuevo debe ser organizador', async () => {
    const r = route('PUT', '/leagues/2/owner');
    await expect(build().authorize(r, owner, { ownerId: 5 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().authorize(r, admin, { ownerId: 5 })).resolves.toBeUndefined();
    await expect(build().authorize(r, admin, { ownerId: 20 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().authorize(r, admin, { ownerId: 404 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la cache no confunde una categoria con una lista de una sola categoria', async () => {
    const ownership = new OwnershipService();
    const lookups = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('?ids=')
        ? new Response(JSON.stringify([{ categoryId: 4, leagueId: 1, ownerId: 5 }]))
        : new Response(JSON.stringify({ leagueId: 1, ownerId: 5 })),
    );
    expect(await ownership.league('categories', 4)).toEqual({ leagueId: 1, ownerId: 5 });
    expect(await ownership.categories([4])).toEqual([{ categoryId: 4, leagueId: 1, ownerId: 5 }]);
    lookups.mockRestore();
  });

  it('una asignacion exitosa rige de inmediato: olvida la propiedad guardada en cache', async () => {
    const ownership = new OwnershipService();
    const lookups = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ leagueId: 2, ownerId: null })));
    await ownership.league('leagues', 2);
    await ownership.league('leagues', 2);
    expect(lookups).toHaveBeenCalledTimes(1);

    const access = new AccessService(ownership, {} as any);
    access.afterResponse(route('PUT', '/leagues/2/owner'), 409);
    await ownership.league('leagues', 2);
    expect(lookups).toHaveBeenCalledTimes(1);
    access.afterResponse(route('PUT', '/leagues/2/owner'), 200);
    await ownership.league('leagues', 2);
    expect(lookups).toHaveBeenCalledTimes(2);
    lookups.mockRestore();
  });
});

describe('Datos de cada usuario', () => {
  it('el arbitro confirma solo sus asignaciones y ve solo sus datos', async () => {
    await expect(build().authorize(route('PUT', '/assignments/7/confirm'), arbitro, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('PUT', '/assignments/8/confirm'), arbitro, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().authorize(route('GET', '/referees/2'), arbitro, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('GET', '/referees/3'), arbitro, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cada usuario ve y cambia solo sus notificaciones; un organizador no ve las de otros', async () => {
    const me = user('espectador', { sub: 9 });
    await expect(build().authorize(route('GET', '/notifications/9'), me, {})).resolves.toBeUndefined();
    await expect(build().authorize(route('GET', '/notifications/10'), me, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().authorize(route('GET', '/notifications/9'), other, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().authorize(route('PUT', '/notifications/preferences'), me, { userId: 9 })).resolves.toBeUndefined();
    await expect(build().authorize(route('PUT', '/notifications/preferences'), me, { userId: 10 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
