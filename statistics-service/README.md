# Statistics Service — SportsLeague (documento, sección 2.6)

Consolida los resultados y eventos de cada partido finalizado para calcular
automáticamente la tabla de posiciones, el ranking de goleadores y las
tarjetas acumuladas por jugador.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma | NestJS + Prisma ✅ |
| Base de datos | Statistics DB (PostgreSQL) | `statistics_db` (PostgreSQL 16) ✅ |
| Tabla `standings` | season_id, team_id, points, wins, draws, losses, goal_difference | las mismas + goals_for, goals_against (ver nota) |
| Tabla `top_scorers` | season_id, player_id, goals | ✅ |
| Tabla `disciplinary_records` | player_id, yellow_cards, red_cards | ✅ |
| Índices (3.6) | (season_id, team_id) · (season_id, goals) · disciplinary_records.player_id | los tres ✅ |
| Restricciones (3.6) | (season_id, team_id) único · campos NOT NULL · goals ≥ 0 | todas ✅ (CHECK en la migración) |
| Comunicación (2.6) | Asíncrona (eventos) · REST puntual al League Service por el reglamento | ✅ con timeout, reintentos y circuit breaker |
| Eventos (2.6) | Consume `match.completed` para recalcular de forma inmediata e idempotente | ✅ |
| Caché | Redis para las tablas de posiciones | ✅ se invalida en cada recálculo |

**Notas sobre las tablas agregadas:**

- `standings.goals_for` y `goals_against`: son los goles que dan la
  `goal_difference` y sirven como criterio de desempate (`goles_a_favor`).
- `match_results` y `match_result_events`: guardan el acta recibida en cada
  `match.completed`. Con ellas la temporada se recalcula **desde cero** en
  cada acta, en lugar de sumar sobre el valor anterior. Por eso es
  idempotente: si llega dos veces la misma acta, o una corregida (un gol
  anulado después del cierre), el resultado es el correcto y nunca se
  duplican goles ni puntos (documento 1.5 y 4.3).

## Endpoints (documento, 2.6)

| Método | Ruta |
|---|---|
| GET | `/api/v1/standings/{seasonId}` |
| GET | `/api/v1/top-scorers/{seasonId}` |
| GET | `/api/v1/players/{id}/disciplinary-record` |

Adicional: `POST /api/v1/standings/{seasonId}/recalculate` para recalcular
con las actas guardadas (útil si el League Service no respondía). Más
`GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

## Qué pasa al llegar `match.completed`

1. Guarda el acta (resultado y eventos) reemplazando la anterior del mismo partido.
2. **Síncrono → League Service:** `GET /categories/{id}/rules` para conocer
   los puntos por victoria y empate y el criterio de desempate (en memoria
   un minuto).
3. Recalcula la tabla de la temporada, los goleadores y las tarjetas de los
   jugadores del acta, e invalida la caché de Redis.

Si el League Service no responde, el acta ya quedó guardada y el recálculo se
reintenta 3 veces cada 15 s (consistencia eventual). También consume
`fixture.published` para que los equipos aparezcan en la tabla con 0 puntos
desde que se publica el calendario.

Documentación interactiva: `http://localhost:3006/docs`
