import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** Respuesta guardada de una escritura, para devolverla igual si la misma solicitud se repite. */
export interface StoredResponse {
  status: number;
  contentType: string | null;
  body: string; // base64
}

const TTL_SECONDS = 600;
const PENDING = 'pending';
const KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Proteccion contra solicitudes duplicadas: una escritura (POST, PUT, PATCH) que trae la
 * cabecera Idempotency-Key se procesa una sola vez durante 10 minutos. Si llega otra vez
 * (doble clic, reintento de red) se devuelve la misma respuesta sin repetir la operacion;
 * si la primera sigue en curso se responde 409. Las claves viven en Redis para que todas
 * las instancias del gateway las compartan; si Redis no responde, se guardan en memoria.
 */
@Injectable()
export class IdempotencyService {
  private readonly memory = new Map<string, { value: string; expires: number }>();

  constructor(private readonly redis: RedisService) {}

  /** Clave de almacenamiento para la solicitud, o null si no aplica (sin cabecera o lectura). */
  keyFor(method: string, path: string, header: string | string[] | undefined, who: string): string | null {
    if (!['POST', 'PUT', 'PATCH'].includes(method) || header === undefined) return null;
    const value = Array.isArray(header) ? header[0] : header;
    if (!KEY_FORMAT.test(value)) {
      throw new BadRequestException('Idempotency-Key debe tener de 8 a 128 caracteres: letras, numeros, guion o guion bajo');
    }
    return `idem:${who}:${method}:${path}:${value}`;
  }

  /** Reserva la clave: null si es nueva, 'pending' si la misma solicitud sigue en curso, o la respuesta guardada. */
  async begin(key: string): Promise<StoredResponse | 'pending' | null> {
    if (this.redis.isConnected()) {
      try {
        const reserved = await this.redis.client.set(key, PENDING, 'EX', TTL_SECONDS, 'NX');
        if (reserved === 'OK') return null;
        return this.parse(await this.redis.client.get(key));
      } catch {
        /* se cae a memoria */
      }
    }
    const now = Date.now();
    const cur = this.memory.get(key);
    if (cur && cur.expires > now) return this.parse(cur.value);
    if (this.memory.size > 10_000) this.memory.clear();
    this.memory.set(key, { value: PENDING, expires: now + TTL_SECONDS * 1000 });
    return null;
  }

  /** Guarda la respuesta para repetirla, o libera la clave (null) si la operacion no se completo. */
  async finish(key: string, response: StoredResponse | null): Promise<void> {
    if (this.redis.isConnected()) {
      try {
        if (response) await this.redis.client.set(key, JSON.stringify(response), 'EX', TTL_SECONDS);
        else await this.redis.client.del(key);
        return;
      } catch {
        /* se cae a memoria */
      }
    }
    if (response) this.memory.set(key, { value: JSON.stringify(response), expires: Date.now() + TTL_SECONDS * 1000 });
    else this.memory.delete(key);
  }

  private parse(value: string | null): StoredResponse | 'pending' | null {
    if (!value) return null;
    if (value === PENDING) return PENDING;
    return JSON.parse(value) as StoredResponse;
  }
}
