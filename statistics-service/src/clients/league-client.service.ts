import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResilientHttpService } from './resilient-http.service';

export interface CategoryRules {
  id: number;
  categoryId: number;
  pointsWin: number;
  pointsDraw: number;
  tiebreakerCriteria: string;
}

/**
 * Statistics Service -> League Service (SINCRONO, documento 2.6 y 4.1):
 * consulta el reglamento de puntuacion de la categoria antes de recalcular la
 * tabla de posiciones. El reglamento cambia muy poco, asi que se guarda en
 * memoria durante un minuto para no consultar en cada partido.
 */
@Injectable()
export class LeagueClientService {
  private readonly baseUrl: string;
  private readonly ttlMs = 60_000;
  private readonly cache = new Map<number, { rules: CategoryRules; until: number }>();

  constructor(
    private readonly resilient: ResilientHttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('LEAGUE_SERVICE_URL', 'http://localhost:3003');
  }

  /** Devuelve el reglamento, o null si la categoria no existe o no tiene reglamento. */
  async getRules(categoryId: number): Promise<CategoryRules | null> {
    const cached = this.cache.get(categoryId);
    if (cached && cached.until > Date.now()) return cached.rules;

    const res = await this.resilient.get<CategoryRules>(
      'League Service',
      `${this.baseUrl}/api/v1/categories/${categoryId}/rules`,
    );
    if (res.status !== 200 || !res.data) return null;
    this.cache.set(categoryId, { rules: res.data, until: Date.now() + this.ttlMs });
    return res.data;
  }
}
