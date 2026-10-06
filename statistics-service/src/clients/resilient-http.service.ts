import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BreakerState {
  failures: number;
  openUntil: number;
}

/**
 * Llamadas REST sincronas con los mecanismos de resiliencia del documento (4.4):
 *  - Timeout: cada llamada espera como maximo 3 segundos.
 *  - Retries: ante fallo de red, timeout o error 5xx se reintenta 2 veces
 *    con backoff (300 ms, 600 ms).
 *  - Circuit breaker (conceptual): tras 3 operaciones fallidas seguidas contra
 *    el mismo servicio, el circuito se abre 20 s y las llamadas fallan de
 *    inmediato sin tocar la red. Pasado ese tiempo se vuelve a probar.
 *  - Gestion de errores: si el servicio no esta disponible se responde 503.
 * Las respuestas 4xx (por ejemplo 404) no se reintentan: se devuelven al llamador.
 */
@Injectable()
export class ResilientHttpService {
  private readonly logger = new Logger(ResilientHttpService.name);
  private readonly timeoutMs = 3000;
  private readonly maxRetries = 2;
  private readonly failureThreshold = 3;
  private readonly openMs = 20000;
  private readonly breakers = new Map<string, BreakerState>();

  constructor(private readonly http: HttpService) {}

  async get<T>(serviceName: string, url: string): Promise<{ status: number; data: T | null }> {
    const breaker = this.breakers.get(serviceName) ?? { failures: 0, openUntil: 0 };
    this.breakers.set(serviceName, breaker);

    if (Date.now() < breaker.openUntil) {
      throw new ServiceUnavailableException(
        `${serviceName} no disponible (circuit breaker abierto). Intente de nuevo en unos segundos.`,
      );
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await firstValueFrom(this.http.get<T>(url, { timeout: this.timeoutMs }));
        breaker.failures = 0;
        return { status: res.status, data: res.data };
      } catch (err: any) {
        const status: number | undefined = err?.response?.status;
        if (status && status < 500) {
          breaker.failures = 0;
          return { status, data: null };
        }
        this.logger.warn(`${serviceName}: intento ${attempt + 1} fallido (${url}): ${err.message}`);
        if (attempt < this.maxRetries) await sleep(300 * 2 ** attempt);
      }
    }

    breaker.failures++;
    if (breaker.failures >= this.failureThreshold) {
      breaker.openUntil = Date.now() + this.openMs;
      this.logger.error(`Circuit breaker ABIERTO para ${serviceName} durante ${this.openMs / 1000} s`);
    }
    throw new ServiceUnavailableException(
      `${serviceName} no respondio despues de ${this.maxRetries + 1} intentos`,
    );
  }
}
