import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResilientHttpService } from './resilient-http.service';

export interface TeamInfo {
  id: number;
  name: string;
  categoryId: number;
}

/**
 * Fixture Service -> Team Service (SINCRONO, documento 2.1, 2.3 y 4.1):
 * valida los equipos participantes al generar el calendario.
 */
@Injectable()
export class TeamClientService {
  private readonly baseUrl: string;

  constructor(
    private readonly resilient: ResilientHttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('TEAM_SERVICE_URL', 'http://localhost:3004');
  }

  /** Devuelve el equipo, o null si no existe. */
  async getTeam(teamId: number): Promise<TeamInfo | null> {
    const res = await this.resilient.get<TeamInfo>(
      'Team Service',
      `${this.baseUrl}/api/v1/teams/${teamId}`,
    );
    return res.status === 200 ? res.data : null;
  }
}
