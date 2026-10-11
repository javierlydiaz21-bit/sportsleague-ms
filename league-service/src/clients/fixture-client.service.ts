import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { internalHeaders } from '../security/internal-auth';

export interface FixtureMatch {
  id: number;
  scheduledAt: string;
}

/**
 * COMUNICACION SINCRONA (REST) League Service -> Fixture Service, solo para validar
 * ediciones: antes de cambiar el deporte o las fechas de una temporada hay que saber si
 * ya tiene calendario. Si el Fixture Service no responde se rechaza la edicion (503):
 * no se valida a ciegas un cambio que podria dejar partidos fuera de su temporada.
 */
@Injectable()
export class FixtureClientService {
  private readonly logger = new Logger(FixtureClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs = 5000;
  private readonly attempts = 3;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('FIXTURE_SERVICE_URL', 'http://localhost:3001');
  }

  /** Partidos del calendario de una temporada (lista vacia si no tiene calendario). */
  async matchesOf(seasonId: number): Promise<FixtureMatch[]> {
    const url = `${this.baseUrl}/api/v1/fixtures/${seasonId}`;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        const res = await fetch(url, { headers: internalHeaders(), signal: AbortSignal.timeout(this.timeoutMs) });
        if (res.status === 404) return [];
        if (res.ok) return (await res.json()) as FixtureMatch[];
        this.logger.warn(`Fixture Service respondio ${res.status} (${url}), intento ${attempt}`);
      } catch (err) {
        this.logger.warn(`Fixture Service no respondio (${url}), intento ${attempt}: ${(err as Error).message}`);
      }
      if (attempt < this.attempts) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    throw new ServiceUnavailableException(
      'No se pudo consultar el calendario en el Fixture Service; intente de nuevo en unos segundos',
    );
  }
}
