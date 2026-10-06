# Live Score Service — SportsLeague (documento, sección 2.5)

Permite a árbitros o delegados registrar eventos en tiempo real (goles,
tarjetas amarillas/rojas, sustituciones) y actualiza al instante el marcador
de todos los espectadores conectados por WebSocket.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS con WebSockets (Socket.IO) + Prisma | NestJS + Socket.IO + Prisma ✅ |
| Base de datos | Live Score DB (PostgreSQL) | `live_score_db` (PostgreSQL 16) ✅ |
| Tabla `match_events` | match_id, type, player_id, minute, team_id | las mismas cinco + id ✅ |
| Índices (3.5) | match_id · (match_id, minute) | los dos ✅ |
| Restricciones (3.5) | match_id, type, minute NOT NULL · type ∈ {gol, tarjeta_amarilla, tarjeta_roja, sustitucion} | todas ✅ |
| Comunicación (2.5) | REST para registrar eventos · WebSocket para difundirlos | ✅ |
| Eventos (2.5, 4.2) | Publica `match.event` y `match.completed` | ✅ |
| Métricas (9.2) | eventos por minuto · latencia del marcador en vivo | `GET /api/v1/metrics` ✅ |

**Nota sobre `live_matches`:** el marcador necesita saber qué equipo es local y
cuál visitante, y el acta (`match.completed`) debe llevar la temporada y la
categoría para que el Statistics Service aplique el reglamento. Esa
información vive en otros servicios, así que se guarda una copia local
sincronizada por el evento `fixture.published` (documento 3.8: "información
previamente sincronizada mediante eventos"). Si el evento se perdió, se pide
por REST al Fixture Service y al Team Service, con timeout, reintentos y
circuit breaker. La tabla también guarda el estado en vivo del partido, el
motivo de una suspensión y el pico de espectadores conectados (lo usa el
Analytics Service para estimar la asistencia).

## Endpoints (documento, 2.5)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/v1/matches/{id}/events` | Registra un gol, tarjeta o sustitución |
| GET  | `/api/v1/matches/{id}/live` | Marcador y línea de tiempo |
| POST | `/api/v1/matches/{id}/complete` | Cierra el partido y publica el acta |
| WS   | `/live-scores` | Canal de suscripción por `match_id` |

Endpoints adicionales: `DELETE /api/v1/matches/{id}/events/{eventId}` (anular
un evento), `POST /api/v1/matches/{id}/suspend` y `GET /api/v1/live-matches?status=en_curso`
(partidos que se juegan ahora). Más `GET /api/v1/health`, `GET /api/v1/status`,
`GET /api/v1/metrics` y la documentación en `/docs`.

## Eventos publicados (canal `sportsleague.match-events`)

| Evento | Cuándo | Consumidores |
|---|---|---|
| `match.event` | cada gol, tarjeta o sustitución | Fixture (estado `en_curso`), Statistics, WebSocket |
| `match.completed` | al cerrar el partido, o al corregir el acta de un partido cerrado | Statistics, Notification, Fixture |
| `match.suspended` | al suspender el partido | Fixture, Notification |
| `match.event_annulled` | al anular un evento | WebSocket |

Cada instancia del servicio está suscrita al mismo canal y difunde por
WebSocket lo que recibe: un gol registrado en una instancia llega a los
espectadores de todas (escalado horizontal, documento 1.2).

**Consistencia eventual (3.8, 4.3):** cerrar de nuevo un partido ya cerrado
reenvía el acta, y registrar o anular un evento después del cierre la corrige.
El Statistics Service la reprocesa sin duplicar efectos.

## WebSocket

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:8080/live-scores"); // a través del API Gateway
socket.emit("subscribe", { matchId: 1 });
socket.on("snapshot", (live) => console.log(live.score));            // estado completo
socket.on("update", ({ type, live }) => console.log(type, live.score)); // cada cambio
```

## Ejemplo

```http
POST /api/v1/matches/1/events
{ "type": "gol", "minute": 23, "teamId": 1, "playerId": 4 }
```

Documentación interactiva: `http://localhost:3005/docs`
