import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, of } from 'rxjs';

export interface LeagueCategory {
  id: number;
  leagueId: number;
  name: string;
  ageRange: string; // "min-max", ej: "15-17"
}

/**
 * COMUNICACION SINCRONA (REST) Team Service -> League Service.
 *
 * El age_range de la categoria vive en la League DB (documento, 3.2) y es
 * necesario para validar la elegibilidad del jugador al ficharlo. Como no hay
 * joins entre bases de datos de distintos servicios, se hace una consulta REST
 * puntual (documento, 3.8), con timeout: si el League Service no responde, el
 * jugador queda en estado "pendiente" en vez de bloquear el fichaje
 * (gestion de errores y timeouts, documento 4.4).
 */
@Injectable()
export class LeagueClientService {
  private readonly logger = new Logger(LeagueClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs = 3000;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('LEAGUE_SERVICE_URL', 'http://localhost:3003');
  }

  async getCategory(categoryId: number): Promise<LeagueCategory | null> {
    const url = `${this.baseUrl}/api/v1/categories/${categoryId}`;
    const response = await firstValueFrom(
      this.http.get<LeagueCategory>(url, { timeout: this.timeoutMs }).pipe(
        catchError((err) => {
          this.logger.warn(`League Service no respondio (${url}): ${err.message}`);
          return of(null);
        }),
      ),
    );
    return response ? response.data : null;
  }
}
