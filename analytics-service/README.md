# Analytics Service — SportsLeague (documento, sección 2.8)

Ejecuta procesos ETL periódicos sobre réplicas de solo lectura de las bases de
datos operativas para calcular los KPIs globales de la liga: asistencia
estimada por partido, partidos suspendidos y evolución del rendimiento de
cada equipo a lo largo de la temporada.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma (conexión de solo lectura a réplicas) | NestJS + Prisma (base propia) + `pg` en modo solo lectura (réplicas) ✅ |
| Base de datos | Analytics DB (PostgreSQL) | `analytics_db` (PostgreSQL 16) ✅ |
| Tablas (3.7) | attendance_estimates, suspended_matches, team_performance_trend | las tres ✅ + season_id, match_number y points (ver nota) |
| Índices (3.7) | match_id en las dos primeras · (team_id, season_id) | ✅ |
| Restricciones (3.7) | match_id, team_id, season_id NOT NULL · se reescriben en cada corrida | ✅ |
| Comunicación (2.8) | Por lotes (ETL periódico) sobre réplicas de lectura | ✅ cada `ETL_INTERVAL_SECONDS` |
| Eventos (2.8) | No publica ni consume eventos | ✅ |

**Notas:**

- `season_id` en `attendance_estimates` y `suspended_matches` permite filtrar por temporada.
- `team_performance_trend` es una serie: una fila por equipo y partido jugado
  (`match_number`), con los puntos acumulados (`points`) y los puntos por
  partido hasta ese momento (`trend_metric`).
- `etl_runs` guarda el historial de corridas (cuándo, resultado y errores).

## De dónde sale cada KPI

| KPI | Réplica | Cálculo |
|---|---|---|
| Asistencia estimada | Live Score (`live_matches.peak_viewers`) | Pico de espectadores conectados al marcador × `ATTENDANCE_FACTOR` |
| Partidos suspendidos | Fixture (`matches.status`) + Live Score (motivo) | Partidos con estado `suspendido` |
| Evolución del rendimiento | Statistics (`match_results`) | Puntos acumulados por equipo, en orden cronológico |
| Resumen | Fixture | Partidos por estado |

Las conexiones a las réplicas se abren con `default_transaction_read_only=on`:
el ETL no puede modificar datos operativos aunque, como en docker compose, la
URL apunte a la base principal. En producción deben apuntar a réplicas de
lectura. Si una réplica no responde, se actualiza lo demás y la corrida queda
como `parcial`.

## Endpoints (documento, 2.8)

| Método | Ruta |
|---|---|
| GET | `/api/v1/analytics/attendance?seasonId=` |
| GET | `/api/v1/analytics/suspended-matches?seasonId=` |
| GET | `/api/v1/analytics/team-trend/{teamId}?seasonId=` |

Adicionales: `GET /api/v1/analytics/season-trend/{seasonId}` (todos los
equipos de una temporada), `GET /api/v1/analytics/summary` y
`POST /api/v1/analytics/etl/run` (correr el ETL sin esperar). Más
`GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

Documentación interactiva: `http://localhost:3008/docs`
