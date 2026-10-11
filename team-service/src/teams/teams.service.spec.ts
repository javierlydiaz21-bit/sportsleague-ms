import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TeamsService, calculateAge } from './teams.service';

describe('calculateAge', () => {
  const today = new Date('2026-09-23T12:00:00Z');
  it('cuenta anios cumplidos', () => {
    expect(calculateAge(new Date('2010-05-14'), today)).toBe(16);
  });
  it('resta un anio si el cumpleanios aun no llega', () => {
    expect(calculateAge(new Date('2010-12-01'), today)).toBe(15);
  });
});

function build(category: any) {
  const prisma: any = {
    team: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'Halcones FC', categoryId: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    player: {
      create: jest.fn(({ data }) => ({ id: 1, ...data })),
      findUnique: jest.fn(),
      update: jest.fn(({ data }) => ({ id: 1, ...data })),
    },
  };
  const league: any = { getCategory: jest.fn().mockResolvedValue(category) };
  return { service: new TeamsService(prisma, league), prisma, league };
}

const sub17 = { id: 1, leagueId: 1, name: 'Sub-17', ageRange: '15-17' };
const yearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCMonth(0, 1);
  return d.toISOString().slice(0, 10);
};

describe('TeamsService.addPlayer (elegibilidad por age_range del League Service)', () => {
  it('consulta la categoria del equipo al League Service', async () => {
    const { service, league } = build(sub17);
    await service.addPlayer(1, { birthDate: yearsAgo(16), jerseyNumber: 10 });
    expect(league.getCategory).toHaveBeenCalledWith(1);
  });

  it('marca elegible si la edad esta dentro del rango', async () => {
    const { service } = build(sub17);
    const p = await service.addPlayer(1, { birthDate: yearsAgo(16), jerseyNumber: 10 });
    expect(p.eligibilityStatus).toBe('elegible');
  });

  it('marca no_elegible si la edad esta fuera del rango', async () => {
    const { service } = build(sub17);
    const p = await service.addPlayer(1, { birthDate: yearsAgo(21), jerseyNumber: 7 });
    expect(p.eligibilityStatus).toBe('no_elegible');
  });

  it('marca pendiente si el League Service no responde', async () => {
    const { service } = build(null);
    const p = await service.addPlayer(1, { birthDate: yearsAgo(16), jerseyNumber: 5 });
    expect(p.eligibilityStatus).toBe('pendiente');
  });

  it('responde 404 si el equipo no existe', async () => {
    const { service, prisma } = build(sub17);
    prisma.team.findUnique.mockResolvedValue(null);
    await expect(service.addPlayer(9, { birthDate: yearsAgo(16), jerseyNumber: 5 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('PUT eligibility vuelve a verificar contra el age_range vigente', async () => {
    const { service, prisma } = build(sub17);
    prisma.player.findUnique.mockResolvedValue({
      id: 1,
      birthDate: new Date(yearsAgo(16)),
      eligibilityStatus: 'pendiente',
      team: { categoryId: 1 },
    });
    const p = await service.verifyEligibility(1);
    expect(p.eligibilityStatus).toBe('elegible');
  });
});

describe('TeamsService.findMany', () => {
  it('filtra por categoria e incluye la plantilla', async () => {
    const { service, prisma } = build(sub17);
    await service.findMany({ categoryId: 1 });
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: 1 }, include: expect.objectContaining({ players: expect.anything() }) }),
    );
  });

  it('filtra por lista de ids', async () => {
    const { service, prisma } = build(sub17);
    await service.findMany({ ids: [1, 2] });
    expect(prisma.team.findMany.mock.calls[0][0].where).toEqual({ id: { in: [1, 2] } });
  });

  it('guarda el nombre del jugador al ficharlo', async () => {
    const { service } = build(sub17);
    const p = await service.addPlayer(1, { name: 'Juan Perez', birthDate: yearsAgo(16), jerseyNumber: 9 });
    expect(p.name).toBe('Juan Perez');
  });
});

describe('Elegibilidad por categoria (corregir el rango de edad)', () => {
  // Jugadores de 15, 16, 17 y 18 anios en una categoria Sub-17 (15-17)
  const players = (ages: number[]) =>
    ages.map((age, i) => ({
      id: i + 1,
      name: `Jugador ${i + 1}`,
      jerseyNumber: i + 1,
      birthDate: new Date(yearsAgo(age)),
      eligibilityStatus: age >= 15 && age <= 17 ? 'elegible' : 'no_elegible',
    }));
  function withTeams(category: any, list: any[]) {
    const built = build(category);
    built.prisma.team.findMany.mockResolvedValue([{ id: 1, name: 'Halcones FC', categoryId: 1, players: list }]);
    built.prisma.$transaction = jest.fn(async (ops: any[]) => Promise.all(ops));
    return built;
  }

  it('la vista previa lista quienes cambiarian de elegibilidad, sin modificar nada', async () => {
    const { service, prisma } = withTeams(sub17, players([15, 16, 17, 18]));
    const r = await service.eligibilityPreview(1, '16-18');
    expect(r.players).toBe(4);
    expect(r.becomeIneligible).toBe(1);
    expect(r.becomeEligible).toBe(1);
    expect(r.changes.map((c) => [c.playerId, c.to])).toEqual([
      [1, 'no_elegible'],
      [4, 'elegible'],
    ]);
    expect(r.changes[0].team).toEqual({ id: 1, name: 'Halcones FC' });
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it('la vista previa rechaza un rango invalido (400)', async () => {
    const { service } = withTeams(sub17, []);
    await expect(service.eligibilityPreview(1, '18-15')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.eligibilityPreview(1, '15 a 18')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recalcula con el rango vigente del League Service y solo actualiza a quienes cambian', async () => {
    const { service, prisma } = withTeams({ ...sub17, ageRange: '16-18' }, players([15, 16, 17, 18]));
    const r = await service.recalculateCategory(1);
    expect(r).toEqual({ categoryId: 1, ageRange: '16-18', players: 4, updated: 2 });
    expect(prisma.player.update).toHaveBeenCalledTimes(2);
  });

  it('si el League Service no responde no cambia nada (503)', async () => {
    const { service, prisma } = withTeams(null, players([15]));
    await expect(service.recalculateCategory(1)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.player.update).not.toHaveBeenCalled();
  });
});
