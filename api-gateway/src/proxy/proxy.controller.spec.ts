import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from '../security/idempotency.service';
import { ProxyController } from './proxy.controller';

const organizer = { sub: 1, email: 'admin@sportsleague.co', name: 'Organizador', role: 'organizador', refereeId: null };

function build() {
  const auth: any = { verify: jest.fn().mockResolvedValue(organizer) };
  const access: any = { authorize: jest.fn().mockResolvedValue(undefined), afterResponse: jest.fn() };
  const idempotency = new IdempotencyService({ isConnected: () => false } as any);
  return new ProxyController(auth, access, idempotency);
}

function request(headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    path: '/api/v1/leagues',
    originalUrl: '/api/v1/leagues',
    ip: '10.0.0.1',
    body: { name: 'Liga Nueva', sport: 'futbol' },
    headers: { authorization: 'Bearer token-de-usuario', ...headers },
  } as any;
}

function response() {
  const out: any = { locals: {}, headers: {} as Record<string, string> };
  out.status = jest.fn((s: number) => ((out.code = s), out));
  out.setHeader = jest.fn((k: string, v: string) => ((out.headers[k] = v), out));
  out.send = jest.fn((b: Buffer) => ((out.body = b.toString()), out));
  return out;
}

describe('ProxyController (llamadas del gateway a los microservicios)', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.INTERNAL_TOKEN = 'token-interno-del-gateway';
    fetchMock = jest.fn().mockResolvedValue({
      status: 201,
      headers: { get: () => 'application/json' },
      arrayBuffer: async () => Buffer.from('{"id":10}'),
    });
    global.fetch = fetchMock as any;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.INTERNAL_TOKEN;
  });

  it('envia el token interno y el usuario autenticado al microservicio', async () => {
    await build().forward(request(), response());
    const sent = fetchMock.mock.calls[0][1].headers;
    expect(sent['x-internal-token']).toBe('token-interno-del-gateway');
    expect(sent['x-user-id']).toBe('1');
  });

  it('no reenvia un token interno ni un usuario que invente el cliente', async () => {
    await build().forward(request({ 'x-internal-token': 'inventado', 'x-user-id': '99' }), response());
    const sent = fetchMock.mock.calls[0][1].headers;
    expect(sent['x-internal-token']).toBe('token-interno-del-gateway');
    expect(sent['x-user-id']).toBe('1');
  });

  it('con la misma Idempotency-Key la escritura llega una sola vez y la repeticion recibe la misma respuesta', async () => {
    const proxy = build();
    const first = response();
    const second = response();
    await proxy.forward(request({ 'idempotency-key': 'crear-liga-0001' }), first);
    await proxy.forward(request({ 'idempotency-key': 'crear-liga-0001' }), second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.code).toBe(201);
    expect(second.body).toBe('{"id":10}');
    expect(second.headers['idempotent-replay']).toBe('true');
  });

  it('si la primera sigue en curso, la repeticion recibe 409', async () => {
    const proxy = build();
    let release: (v: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    const pending = proxy.forward(request({ 'idempotency-key': 'crear-liga-0002' }), response());
    await new Promise((r) => setImmediate(r));
    await expect(proxy.forward(request({ 'idempotency-key': 'crear-liga-0002' }), response())).rejects.toBeInstanceOf(ConflictException);
    release({ status: 201, headers: { get: () => 'application/json' }, arrayBuffer: async () => Buffer.from('{}') });
    await pending;
  });

  it('sin Idempotency-Key cada envio se procesa como hasta ahora', async () => {
    const proxy = build();
    await proxy.forward(request(), response());
    await proxy.forward(request(), response());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
