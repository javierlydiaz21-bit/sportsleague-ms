import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ResilientHttpService } from './resilient-http.service';

const networkError = () => throwError(() => ({ message: 'connect ECONNREFUSED' }));

describe('ResilientHttpService (timeouts, retries y circuit breaker)', () => {
  it('devuelve los datos cuando el servicio responde', async () => {
    const http: any = { get: jest.fn(() => of({ status: 200, data: { ok: true } })) };
    const res = await new ResilientHttpService(http).get('League Service', 'http://x');
    expect(res).toEqual({ status: 200, data: { ok: true } });
    expect(http.get.mock.calls[0][1]).toEqual({ timeout: 3000 });
  });

  it('no reintenta ante un 404: lo devuelve al llamador', async () => {
    const http: any = { get: jest.fn(() => throwError(() => ({ message: '404', response: { status: 404 } }))) };
    const res = await new ResilientHttpService(http).get('Team Service', 'http://x');
    expect(res).toEqual({ status: 404, data: null });
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('reintenta 2 veces ante fallo de red y luego responde 503', async () => {
    const http: any = { get: jest.fn(networkError) };
    await expect(new ResilientHttpService(http).get('Team Service', 'http://x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(http.get).toHaveBeenCalledTimes(3);
  });

  it('se recupera si un reintento tiene exito', async () => {
    const http: any = {
      get: jest.fn().mockImplementationOnce(networkError).mockImplementation(() => of({ status: 200, data: 1 })),
    };
    const res = await new ResilientHttpService(http).get('League Service', 'http://x');
    expect(res.data).toBe(1);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('tras 3 fallos seguidos abre el circuito y falla sin tocar la red', async () => {
    const http: any = { get: jest.fn(networkError) };
    const client = new ResilientHttpService(http);
    for (let i = 0; i < 3; i++) {
      await expect(client.get('Team Service', 'http://x')).rejects.toThrow('no respondio');
    }
    const callsBefore = http.get.mock.calls.length;
    await expect(client.get('Team Service', 'http://x')).rejects.toThrow('circuit breaker abierto');
    expect(http.get.mock.calls.length).toBe(callsBefore);
  }, 15000);
});
