# API Gateway — SportsLeague (documento, sección 5)

Punto de entrada único para el panel de organizadores, la app de árbitros, la
app de espectadores y la web pública. Ningún cliente llama directamente a un
microservicio: el gateway valida el token, aplica los permisos, limita la
tasa de solicitudes, registra cada petición y la enruta al servicio que
corresponde.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Enrutamiento (5.1) | Hacia los 8 microservicios según el path | tabla de rutas en `src/proxy/routes.ts` ✅ |
| Autenticación (5.2, 10.1) | JWT + refresh token; 401 si falta, es inválido o venció | ✅ access token de 15 min, refresh token de 7 días que rota en cada uso |
| Permisos (5.2, 10.2) | Un árbitro solo registra eventos de los partidos que tiene asignados | ✅ se cruzan sus asignaciones en el Referee Service |
| Contraseñas (10.3) | bcrypt | ✅ |
| Rate limiting (5.3) | Por cliente/IP, más estricto en escrituras | ✅ 600 lecturas y 120 escrituras por minuto, contadores en Redis |
| Logging (5.3, 9.1) | IP, fecha, endpoint, método, usuario, código y tiempo de respuesta | ✅ una línea JSON por petición, con `match_id` cuando aplica |
| CORS (10.7) | Solo los dominios autorizados | ✅ `CORS_ORIGINS` |
| Métricas (9.2) | Solicitudes por segundo, tiempos y errores | ✅ `GET /api/v1/metrics` (Prometheus) |
| WebSocket | Marcador en vivo | ✅ reenvía `/socket.io` (namespace `/live-scores`) al Live Score Service |

## Endpoints propios

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/v1/auth/register` | Público: crea una cuenta de espectador |
| POST | `/api/v1/auth/login` | Público |
| POST | `/api/v1/auth/refresh` | Con refresh token |
| POST | `/api/v1/auth/logout` | Con refresh token |
| GET  | `/api/v1/auth/me` | Autenticado |
| POST | `/api/v1/auth/users` | Organizador: crea cuentas (por ejemplo, de árbitro con su `refereeId`) |
| GET  | `/api/v1/auth/users` | Organizador |
| GET  | `/api/v1/health/services` | Público: estado de los 8 servicios |

Más `GET /api/v1/health`, `GET /api/v1/status`, `GET /api/v1/metrics` y la
documentación en `/docs`. Al arrancar crea el organizador inicial
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Permisos por ruta

| Acceso | Rutas |
|---|---|
| Público | Lecturas de ligas, categorías, equipos, calendario, partidos, marcador en vivo, posiciones, goleadores y tarjetas |
| Organizador | Toda escritura de League, Team y Fixture; registrar árbitros; analítica; recalcular posiciones |
| Árbitro asignado u organizador | `POST /matches/{id}/events`, `/complete`, `/suspend` y anular eventos |
| El propio árbitro | Ver sus datos y asignaciones, cambiar su disponibilidad, confirmar sus asignaciones |
| El propio usuario | Sus notificaciones y preferencias |

**CSRF (10.6):** el token viaja en el header `Authorization`, no en una
cookie, así que un sitio ajeno no puede hacer peticiones en nombre del
usuario aunque este tenga la sesión abierta.

## Ejemplo

```http
POST /api/v1/auth/login
{ "email": "admin@sportsleague.co", "password": "admin12345" }

GET /api/v1/standings/1                       (público)
POST /api/v1/leagues                          (Authorization: Bearer <accessToken>)
```

Documentación interactiva: `http://localhost:8080/docs`
