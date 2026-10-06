import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export type Source = 'fixture' | 'liveScore' | 'statistics';

const ENV: Record<Source, string> = {
  fixture: 'FIXTURE_REPLICA_URL',
  liveScore: 'LIVE_SCORE_REPLICA_URL',
  statistics: 'STATISTICS_REPLICA_URL',
};

/**
 * Conexiones a las replicas de solo lectura de Fixture, Live Score y Statistics
 * (documento 2.8). Cada conexion abre sus transacciones en modo solo lectura
 * (default_transaction_read_only): el ETL no puede modificar datos operativos
 * aunque la URL apunte a la base principal, como en docker compose.
 */
@Injectable()
export class ReplicasService implements OnModuleDestroy {
  private readonly pools = new Map<Source, Pool>();

  constructor(private readonly config: ConfigService) {}

  private pool(source: Source): Pool {
    let pool = this.pools.get(source);
    if (!pool) {
      const connectionString = this.config.get<string>(ENV[source]);
      if (!connectionString) throw new Error(`Falta la variable ${ENV[source]}`);
      pool = new Pool({
        connectionString,
        max: 2,
        connectionTimeoutMillis: 5000,
        statement_timeout: 30000,
        options: '-c default_transaction_read_only=on',
      });
      pool.on('error', () => undefined); // una replica caida no debe tumbar el servicio
      this.pools.set(source, pool);
    }
    return pool;
  }

  async query<T>(source: Source, sql: string): Promise<T[]> {
    const result = await this.pool(source).query(sql);
    return result.rows as T[];
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((p) => p.end()));
  }
}
