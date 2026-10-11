import { INTERNAL_HEADER, internalAuth, internalAuthMode, sameToken } from './internal-auth';

const TOKEN = 'secreto-de-prueba-0123456789abcdef';

/** Ejecuta el middleware con una peticion simulada y devuelve si dejo pasar y que respondio. */
function call(mw: ReturnType<typeof internalAuth>, { method = 'GET', path = '/api/v1/leagues', token }: { method?: string; path?: string; token?: string } = {}) {
  const headers: Record<string, string> = token === undefined ? {} : { [INTERNAL_HEADER]: token };
  const req: any = { method, path, originalUrl: path, get: (h: string) => headers[h.toLowerCase()] };
  const out: { passed: boolean; status?: number; body?: any } = { passed: false };
  const res: any = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: any) {
      out.body = body;
      return this;
    },
  };
  mw(req, res, () => (out.passed = true));
  return out;
}

describe('Token interno entre servicios (llamadas directas)', () => {
  const enforce = internalAuth(TOKEN, 'enforce');

  it('rechaza con 401 una llamada directa sin token', () => {
    const r = call(enforce);
    expect(r.passed).toBe(false);
    expect(r.status).toBe(401);
  });

  it('rechaza con 401 un token incorrecto, tambien en escrituras', () => {
    expect(call(enforce, { token: 'otro-token' }).status).toBe(401);
    expect(call(enforce, { method: 'POST', token: TOKEN.slice(0, -1) }).status).toBe(401);
    expect(call(enforce, { method: 'POST', token: '' }).status).toBe(401);
  });

  it('deja pasar la llamada legitima del gateway o de otro servicio', () => {
    expect(call(enforce, { token: TOKEN }).passed).toBe(true);
    expect(call(enforce, { method: 'POST', token: TOKEN }).passed).toBe(true);
  });

  it('deja abiertos el estado del servicio, las metricas y la documentacion', () => {
    for (const path of ['/api/v1/health', '/api/v1/status', '/api/v1/metrics', '/docs', '/openapi.json']) {
      expect(call(enforce, { path }).passed).toBe(true);
    }
    expect(call(enforce, { path: '/api/v1/healthy-leagues' }).status).toBe(401);
  });

  it('en modo enforce sin token configurado rechaza todo (falla cerrado)', () => {
    expect(call(internalAuth('', 'enforce'), { token: '' }).status).toBe(401);
  });

  it('en modo report deja pasar pero no exige el token (activacion gradual)', () => {
    expect(call(internalAuth(TOKEN, 'report')).passed).toBe(true);
  });

  it('sin INTERNAL_AUTH exige el token si esta configurado', () => {
    expect(internalAuthMode(TOKEN, undefined)).toBe('enforce');
    expect(internalAuthMode('', undefined)).toBe('report');
    expect(internalAuthMode(TOKEN, 'otro')).toBe('enforce');
  });

  it('compara tokens de distinto largo sin fallar', () => {
    expect(sameToken('a', 'ab')).toBe(false);
    expect(sameToken(TOKEN, TOKEN)).toBe(true);
  });
});
