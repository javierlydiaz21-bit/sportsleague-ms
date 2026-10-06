import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReplicasService, Source } from './replicas.service';
import {
  FixtureMatchRow,
  LiveMatchRow,
  MatchResultRow,
  countByStatus,
  estimateAttendance,
  performanceTrend,
  suspendedMatches,
} from './transform';

/**
 * Proceso ETL periodico (documento 2.8): extrae de las replicas de solo lectura,
 * transforma en KPIs y reescribe las tablas de la Analytics DB. Corre por lotes
 * cada ETL_INTERVAL_SECONDS, no en tiempo real, para no competir con las bases
 * operativas. Si una replica no responde, se actualiza lo que se pueda (parcial).
 */
@Injectable()
export class EtlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EtlService.name);
  private timers: NodeJS.Timeout[] = [];
  private running: ReturnType<EtlService['execute']> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly replicas: ReplicasService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const seconds = Number(this.config.get('ETL_INTERVAL_SECONDS', 60));
    this.logger.log(`ETL programado cada ${seconds} s`);
    const tick = () => this.run().catch((err) => this.logger.error(`ETL fallido: ${err.message}`));
    this.timers.push(setTimeout(tick, 5000), setInterval(tick, seconds * 1000));
    this.timers.forEach((t) => t.unref());
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  /** Ejecuta el ETL; si ya hay una corrida en curso, devuelve esa misma. */
  run() {
    if (!this.running) {
      this.running = this.execute().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async execute() {
    const startedAt = new Date();
    const errors: string[] = [];
    const extract = async <T>(source: Source, sql: string): Promise<T[] | null> => {
      try {
        return await this.replicas.query<T>(source, sql);
      } catch (err) {
        errors.push(`${source}: ${(err as Error).message}`);
        return null;
      }
    };

    // Extraccion (replicas de solo lectura)
    const fixture = await extract<FixtureMatchRow>('fixture', 'SELECT id, season_id, status FROM matches');
    const live = await extract<LiveMatchRow>(
      'liveScore',
      'SELECT match_id, season_id, status, suspension_reason, peak_viewers FROM live_matches',
    );
    const results = await extract<MatchResultRow>(
      'statistics',
      'SELECT match_id, season_id, home_team, away_team, home_points, away_points, completed_at FROM match_results',
    );

    // Transformacion y carga: cada tabla se reescribe completa
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const loaded: Record<string, number> = {};
    if (live) {
      const rows = estimateAttendance(live, Number(this.config.get('ATTENDANCE_FACTOR', 1)));
      ops.push(this.prisma.attendanceEstimate.deleteMany(), this.prisma.attendanceEstimate.createMany({ data: rows }));
      loaded.attendance = rows.length;
    }
    if (fixture) {
      const rows = suspendedMatches(fixture, live ?? []);
      ops.push(this.prisma.suspendedMatch.deleteMany(), this.prisma.suspendedMatch.createMany({ data: rows }));
      loaded.suspended = rows.length;
    }
    if (results) {
      const rows = performanceTrend(results);
      ops.push(this.prisma.teamPerformanceTrend.deleteMany(), this.prisma.teamPerformanceTrend.createMany({ data: rows }));
      loaded.trend = rows.length;
    }
    if (ops.length) await this.prisma.$transaction(ops);

    const status = errors.length === 0 ? 'ok' : errors.length === 3 ? 'error' : 'parcial';
    const run = await this.prisma.etlRun.create({
      data: {
        startedAt,
        finishedAt: new Date(),
        status,
        summary: fixture ? { ...countByStatus(fixture), loaded } : { loaded },
        errors,
      },
    });
    const msg = `ETL ${status}: ${JSON.stringify(loaded)}${errors.length ? ` errores: ${errors.join(' | ')}` : ''}`;
    if (status === 'ok') this.logger.log(msg);
    else this.logger.warn(msg);
    return run;
  }
}
