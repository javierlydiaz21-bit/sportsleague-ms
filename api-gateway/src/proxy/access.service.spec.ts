import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccessService } from './access.service';
import { matchRoute } from './routes';

const user = (role: string, extra: any = {}) => ({ sub: 5, email: 'x@x.co', name: 'X', role, refereeId: null, ...extra });
const arbitro = user('arbitro', { refereeId: 2 });

function build(assignments: any[] = [{ id: 7, matchId: 11 }]) {
  const service = new AccessService();
  jest.spyOn(service, 'assignmentsOf').mockResolvedValue(assignments);
  return service;
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
  ])('%s %s va al servicio %s', (method, path, service) => {
    expect(route(method, path).route.service).toBe(service);
  });

  it('captura el id del partido para validar la asignacion del arbitro', () => {
    expect(route('POST', '/matches/42/complete').id).toBe(42);
    expect(route('DELETE', '/matches/42/events/9').id).toBe(42);
  });

  it('no enruta metodos o rutas desconocidas', () => {
    expect(matchRoute('DELETE', '/leagues/1')).toBeNull();
    expect(matchRoute('GET', '/secreto')).toBeNull();
  });
});

describe('AccessService.authorize (permisos diferenciados, 10.2)', () => {
  it('las rutas publicas no piden token', async () => {
    await expect(build().authorize(route('GET', '/standings/1'), null, {})).resolves.toBeUndefined();
  });

  it('sin token responde 401 en una ruta protegida', async () => {
    await expect(build().authorize(route('POST', '/leagues'), null, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un espectador no puede crear ligas (403)', async () => {
    await expect(build().authorize(route('POST', '/leagues'), user('espectador'), {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el organizador puede todo', async () => {
    await expect(build().authorize(route('POST', '/matches/99/events'), user('organizador'), {})).resolves.toBeUndefined();
  });

  it('el arbitro registra eventos solo en los partidos que tiene asignados', async () => {
    const access = build([{ id: 7, matchId: 11 }]);
    await expect(access.authorize(route('POST', '/matches/11/events'), arbitro, {})).resolves.toBeUndefined();
    await expect(access.authorize(route('POST', '/matches/12/events'), arbitro, {})).rejects.toThrow(
      'No tiene asignado el partido 12',
    );
    expect(access.assignmentsOf).toHaveBeenCalledWith(2);
  });

  it('un espectador no puede registrar eventos en vivo', async () => {
    await expect(build().authorize(route('POST', '/matches/11/events'), user('espectador'), {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el arbitro confirma solo sus asignaciones y ve solo sus datos', async () => {
    const access = build([{ id: 7, matchId: 11 }]);
    await expect(access.authorize(route('PUT', '/assignments/7/confirm'), arbitro, {})).resolves.toBeUndefined();
    await expect(access.authorize(route('PUT', '/assignments/8/confirm'), arbitro, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(access.authorize(route('GET', '/referees/2/assignments'), arbitro, {})).resolves.toBeUndefined();
    await expect(access.authorize(route('GET', '/referees/3/assignments'), arbitro, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('cada usuario ve y cambia solo sus notificaciones', async () => {
    const access = build();
    const espectador = user('espectador');
    await expect(access.authorize(route('GET', '/notifications/5'), espectador, {})).resolves.toBeUndefined();
    await expect(access.authorize(route('GET', '/notifications/6'), espectador, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(access.authorize(route('PUT', '/notifications/preferences'), espectador, { userId: 5 })).resolves.toBeUndefined();
    await expect(
      access.authorize(route('PUT', '/notifications/preferences'), espectador, { userId: 6 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
