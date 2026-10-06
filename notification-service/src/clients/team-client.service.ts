import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResilientHttpService } from './resilient-http.service';

/**
 * Nombre de los equipos para redactar los avisos: consulta REST puntual al Team
 * Service (documento 3.8). Si no responde, el aviso sale con "Equipo {id}" en vez
 * de bloquearse.
 */
@Injectable()
export class TeamClientService {
  private readonly baseUrl: string;
  private readonly names = new Map<number, string>();

  constructor(
    private readonly resilient: ResilientHttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('TEAM_SERVICE_URL', 'http://localhost:3004');
  }

  async teamName(teamId: number): Promise<string> {
    const known = this.names.get(teamId);
    if (known) return known;
    try {
      const res = await this.resilient.get<{ name: string }>('Team Service', `${this.baseUrl}/api/v1/teams/${teamId}`);
      if (res.status === 200 && res.data) {
        this.names.set(teamId, res.data.name);
        return res.data.name;
      }
    } catch {
      /* Team Service no disponible: se usa el id */
    }
    return `Equipo ${teamId}`;
  }
}
