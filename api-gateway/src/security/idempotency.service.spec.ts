import { BadRequestException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

// Sin Redis: la proteccion funciona en memoria
const build = () => new IdempotencyService({ isConnected: () => false } as any);
const ok = { status: 201, contentType: 'application/json', body: Buffer.from('{"id":7}').toString('base64') };

describe('IdempotencyService (solicitudes duplicadas)', () => {
  it('solo aplica a escrituras que traen Idempotency-Key', () => {
    const s = build();
    expect(s.keyFor('GET', '/leagues', 'clave-12345678', '5')).toBeNull();
    expect(s.keyFor('POST', '/leagues', undefined, '5')).toBeNull();
    expect(s.keyFor('POST', '/leagues', 'clave-12345678', '5')).toBe('idem:5:POST:/leagues:clave-12345678');
  });

  it('rechaza claves con formato invalido', () => {
    expect(() => build().keyFor('POST', '/leagues', 'corta', '5')).toThrow(BadRequestException);
    expect(() => build().keyFor('POST', '/leagues', 'con espacios 123', '5')).toThrow(BadRequestException);
  });

  it('la misma solicitud repetida mientras la primera sigue en curso queda en espera (409 en el proxy)', async () => {
    const s = build();
    expect(await s.begin('k')).toBeNull();
    expect(await s.begin('k')).toBe('pending');
  });

  it('una vez completada, la repeticion recibe la misma respuesta sin volver a ejecutarse', async () => {
    const s = build();
    await s.begin('k');
    await s.finish('k', ok);
    expect(await s.begin('k')).toEqual(ok);
  });

  it('si la operacion fallo (5xx o servicio caido) la clave se libera para reintentar', async () => {
    const s = build();
    await s.begin('k');
    await s.finish('k', null);
    expect(await s.begin('k')).toBeNull();
  });

  it('cada usuario tiene sus propias claves', () => {
    const s = build();
    expect(s.keyFor('POST', '/leagues', 'clave-12345678', '5')).not.toBe(s.keyFor('POST', '/leagues', 'clave-12345678', '6'));
  });
});
