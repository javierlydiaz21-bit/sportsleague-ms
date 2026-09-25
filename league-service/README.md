# League Service — SportsLeague (documento, sección 2.2)

Administra las ligas, temporadas y categorías, incluyendo el reglamento
específico de cada competición: puntos por victoria/empate y criterio de
desempate.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma | NestJS + Prisma ✅ |
| Base de datos | League DB (PostgreSQL) | `league_db` (PostgreSQL 16) ✅ |
| Tabla `leagues` | id, name, sport | id, name, sport ✅ |
| Tabla `seasons` | league_id, year, start_date, end_date | id, league_id, year, start_date, end_date ✅ |
| Tabla `categories` | league_id, name, age_range | id, league_id, name, age_range ✅ |
| Tabla `rules` | category_id, points_win, points_draw, tiebreaker_criteria | id, category_id, points_win, points_draw, tiebreaker_criteria ✅ |
| Índices (3.2) | seasons.league_id, categories.league_id, rules.category_id | los tres ✅ |
| Restricciones (3.2) | name/sport NOT NULL · start_date < end_date · age_range obligatorio · rules.category_id único | todas ✅ |
| Comunicación | Síncrona (REST), consultado por otros servicios | Síncrona (REST) ✅ |
| Eventos | No consume eventos | No publica ni consume ✅ |

## Endpoints (documento, 2.2)

| Método | Ruta |
|---|---|
| POST | `/api/v1/leagues` |
| POST | `/api/v1/leagues/{id}/seasons` |
| POST | `/api/v1/seasons/{id}/categories` |
| GET  | `/api/v1/categories/{id}/rules` |
| PUT  | `/api/v1/categories/{id}/rules` |

Además, como en todos los servicios: `GET /api/v1/health` y
`GET /api/v1/status` (documento, 9.3), y la documentación en `/docs`.

**Único endpoint de apoyo:** `GET /api/v1/categories/{id}`. Es la consulta
REST puntual con la que el Team Service lee el `age_range` (el documento
dice en 3.2 que `age_range` es obligatorio *para la validación de
elegibilidad en Team Service*, y en 3.8 que la información de otro servicio
se obtiene con una consulta REST puntual).

## Formato de `age_range`

Texto `"min-max"` en años, por ejemplo `"15-17"`. Se valida el formato y que
el mínimo no sea mayor que el máximo.

## Ejemplo

```http
POST /api/v1/leagues
{ "name": "Liga Municipal de Monteria", "sport": "futbol" }

POST /api/v1/leagues/1/seasons
{ "year": 2026, "startDate": "2026-10-01", "endDate": "2027-02-28" }

POST /api/v1/seasons/1/categories
{ "name": "Sub-17", "ageRange": "15-17" }

PUT /api/v1/categories/1/rules
{ "pointsWin": 3, "pointsDraw": 1, "tiebreakerCriteria": "diferencia_de_goles" }
```

Documentación interactiva: `http://localhost:3003/docs`
