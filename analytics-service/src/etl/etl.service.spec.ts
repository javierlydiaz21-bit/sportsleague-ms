import { EtlService } from './etl.service';

function build(sources: Partial<Record<string, any[] | Error>>) {
  const prisma: any = {
    $transaction: jest.fn(async (ops: any[]) => ops),
    attendanceEstimate: { deleteMany: jest.fn(() => 'del-att'), createMany: jest.fn(({ data }) => ({ att: data })) },
    suspendedMatch: { deleteMany: jest.fn(() => 'del-sus'), createMany: jest.fn(({ data }) => ({ sus: data })) },
    teamPerformanceTrend: { deleteMany: jest.fn(() => 'del-tr'), createMany: jest.fn(({ data }) => ({ tr: data })) },
    etlRun: { create: jest.fn(({ data }) => data) },
  };
  const replicas: any = {
    query: jest.fn(async (source: string) => {
      const v = sources[source];
      if (v instanceof Error) throw v;
      return v ?? [];
    }),
  };
  const config: any = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  return { service: new EtlService(prisma, replicas, config), prisma, replicas };
}

describe('EtlService.run', () => {
  it('lee las tres replicas, reescribe las tablas y registra la corrida', async () => {
    const { service, prisma } = build({
      fixture: [{ id: 1, season_id: 1, status: 'finalizado' }],
      liveScore: [{ match_id: 1, season_id: 1, status: 'finalizado', suspension_reason: null, peak_viewers: 12 }],
      statistics: [],
    });
    const run = await service.run();
    expect(run.status).toBe('ok');
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(6);
    expect(prisma.attendanceEstimate.createMany).toHaveBeenCalledWith({
      data: [{ matchId: 1, seasonId: 1, estimatedAttendance: 12 }],
    });
    expect(run.summary).toMatchObject({ totalMatches: 1, played: 1 });
  });

  it('si una replica no responde, actualiza el resto y la corrida queda parcial', async () => {
    const { service, prisma } = build({ fixture: [], liveScore: new Error('connection refused'), statistics: [] });
    const run = await service.run();
    expect(run.status).toBe('parcial');
    expect(run.errors[0]).toContain('liveScore');
    expect(prisma.attendanceEstimate.deleteMany).not.toHaveBeenCalled();
    expect(prisma.suspendedMatch.deleteMany).toHaveBeenCalled();
  });

  it('no inicia dos corridas a la vez', async () => {
    const { service, replicas } = build({});
    const [a, b] = await Promise.all([service.run(), service.run()]);
    expect(a).toBe(b);
    expect(replicas.query).toHaveBeenCalledTimes(3);
  });
});
