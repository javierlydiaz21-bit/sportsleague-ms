import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResilientHttpService } from './resilient-http.service';

export interface FixtureMatch {
  id: number;
  seasonId: number;
  homeTeam: number;
  awayTeam: number;
  venue: string;
  scheduledAt: string;
  status: string;
}

export interface TeamInfo {
  id: number;
  name: string;
  categoryId: number;
}

/**
 * Consulta REST puntual (documento 3.8) para cuando el evento fixture.published
 * de un partido no llego al Live Score Service: los datos del partido se piden al
 * Fixture Service y la categoria, al Team Service (la categoria del equipo local).
 */
@Injectable()
export class FixtureClientService {
  private readonly fixtureUrl: string;
  private readonly teamUrl: string;

  constructor(
    private readonly resilient: ResilientHttpService,
    config: ConfigService,
  ) {
    this.fixtureUrl = config.get<string>('FIXTURE_SERVICE_URL', 'http://localhost:3001');
    this.teamUrl = config.get<string>('TEAM_SERVICE_URL', 'http://localhost:3004');
  }

  /** Devuelve el partido, o null si no existe. */
  async getMatch(matchId: number): Promise<FixtureMatch | null> {
    const res = await this.resilient.get<FixtureMatch>(
      'Fixture Service',
      `${this.fixtureUrl}/api/v1/matches/${matchId}`,
    );
    return res.status === 200 ? res.data : null;
  }

  /** Devuelve el equipo, o null si no existe. */
  async getTeam(teamId: number): Promise<TeamInfo | null> {
    const res = await this.resilient.get<TeamInfo>('Team Service', `${this.teamUrl}/api/v1/teams/${teamId}`);
    return res.status === 200 ? res.data : null;
  }
}
