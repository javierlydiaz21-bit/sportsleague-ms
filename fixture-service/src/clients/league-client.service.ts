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
 * Fixture Service -> League Service (SINCRONO, documento 2.3 y 4.1):
 * consulta el reglamento vigente de la categoria al generar el calendario.
 */
@Injectable()
export class LeagueClientService {
  private readonly baseUrl: string;

  constructor(
    private readonly resilient: ResilientHttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('LEAGUE_SERVICE_URL', 'http://localhost:3003');
  }

  /** Devuelve el reglamento, o null si la categoria no existe o no tiene reglamento. */
  async getRules(categoryId: number): Promise<CategoryRules | null> {
    const res = await this.resilient.get<CategoryRules>(
      'League Service',
      `${this.baseUrl}/api/v1/categories/${categoryId}/rules`,
    );
    return res.status === 200 ? res.data : null;
  }
}
