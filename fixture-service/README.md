# Fixture Service — SportsLeague (documento, sección 2.3)

Genera automáticamente el calendario completo de partidos de una temporada.
Considera las canchas disponibles, el descanso mínimo entre partidos
consecutivos de un mismo equipo y el equilibrio de partidos jugados como
local y visitante.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma | NestJS + Prisma ✅ |
| Base de datos | Fixture DB (PostgreSQL) | `fixture_db` (PostgreSQL 16) ✅ |
| Tabla `matches` | id, season_id, home_team, away_team, venue, scheduled_at, status | las mismas siete ✅ |
| Índices (3.3) | (season_id, scheduled_at) · status | los dos ✅ |
| Restricciones (3.3) | season_id, home_team, away_team, scheduled_at NOT NULL · home_team ≠ away_team · status ∈ {programado, en_curso, finalizado, suspendido} | todas ✅ |
| Comunicación síncrona (2.3, 4.1) | REST al League Service (reglamento) y al Team Service (equipos participantes) | ✅ |
| Resiliencia (4.4) | timeouts · retries · circuit breaker · 503 si el servicio dependiente no está disponible | ✅ |
| Eventos (2.3, 4.2) | Publica `fixture.published` al confirmar cada jornada completa | un evento por jornada ✅ |

## Endpoints (documento, 2.3)

| Método | Ruta |
|---|---|
| POST | `/api/v1/seasons/{id}/fixtures/generate` |
| GET  | `/api/v1/fixtures/{seasonId}` |
| GET  | `/api/v1/matches/{id}` |
| PUT  | `/api/v1/matches/{id}/venue` |

Más `GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

## Qué pasa al generar el calendario

1. **Síncrono → League Service:** `GET /categories/{categoryId}/rules`. Si la
   categoría no existe o no tiene reglamento, responde 400.
2. **Síncrono → Team Service:** `GET /teams/{id}` por cada equipo. Si alguno
   no existe o es de otra categoría, responde 400.
3. Genera el calendario round-robin:
   - Canchas: los partidos de una misma jornada nunca comparten cancha. Si
     no alcanzan las canchas, responde 400.
   - Descanso: cada equipo juega una vez por jornada; `daysBetweenRounds`
     debe ser mayor o igual a `restDaysMin`.
   - Localía: la diferencia de partidos de local entre equipos es como
     máximo 1.
4. Guarda los partidos en `matches` con estado `programado`.
5. **Asíncrono:** publica `fixture.published` en Redis, un evento por
   jornada, con los partidos, la categoría y la zona.

Si League o Team no responden, cada llamada espera 3 s y se reintenta
2 veces. Tras 3 fallos seguidos el circuit breaker se abre 20 s, y en ese
caso se responde 503.

La `zone` viaja en la petición y en el evento porque el Referee Service la
necesita para asignar árbitros por zona geográfica (2.4). La tabla
`matches` no tiene columna de zona.

## Ejemplo

```http
POST /api/v1/seasons/1/fixtures/generate
{
  "categoryId": 1,
  "zone": "monteria-norte",
  "teamIds": [1, 2, 3, 4],
  "venues": ["Cancha Municipal 1", "Cancha Municipal 2"],
  "startDate": "2026-10-03"
}
```

La respuesta incluye `reglamento`, obtenido del League Service, y
`equiposValidados`, obtenido del Team Service. Son la evidencia de las
llamadas síncronas.

Documentación interactiva: `http://localhost:3001/docs`
