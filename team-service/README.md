# Team Service — SportsLeague (documento, sección 2.1)

Gestiona el registro de equipos, las plantillas de jugadores y la
verificación de elegibilidad (edad mínima/máxima según la categoría).

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma | NestJS + Prisma ✅ |
| Base de datos | Team DB (PostgreSQL) | `team_db` (PostgreSQL 16) ✅ |
| Tabla `teams` | id, name, category_id | id, name, category_id ✅ |
| Tabla `players` | id, team_id, birth_date, eligibility_status, jersey_number | las mismas cinco + name (ver nota) |
| Índices (3.1) | teams.category_id, players.team_id | los dos ✅ |
| Restricciones (3.1) | name NOT NULL · birth_date y eligibility_status obligatorios · team_id FK a teams | todas ✅ |
| Comunicación | Síncrona (REST) | Síncrona (REST) ✅ |
| Eventos | No publica eventos en la versión actual | No publica ni consume ✅ |

**Nota sobre `players.name`:** el documento (3.8) consulta al Team Service la
"información adicional del jugador (nombre, equipo)", así que la plantilla
guarda el nombre. Es opcional al fichar.

## Endpoints (documento, 2.1)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/v1/teams` | Registra un equipo |
| GET  | `/api/v1/teams/{id}` | Consulta un equipo |
| POST | `/api/v1/teams/{id}/players` | Ficha un jugador y valida su elegibilidad |
| GET  | `/api/v1/teams/{id}/players` | Consulta la plantilla del equipo |
| PUT  | `/api/v1/players/{id}/eligibility` | Vuelve a verificar la elegibilidad del jugador |

Lectura de apoyo para la web: `GET /api/v1/teams?categoryId=1` o `?ids=1,2,3`
(equipos con su plantilla).

Más `GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

## Cómo se valida la elegibilidad

Al fichar un jugador (y al llamar `PUT /players/{id}/eligibility`), el Team
Service consulta de forma **síncrona** al League Service
(`GET /api/v1/categories/{category_id}`), lee el `age_range` (por ejemplo
`"15-17"`) y compara con la edad calculada desde `birth_date`:

- dentro del rango → `elegible`
- fuera del rango → `no_elegible`
- League Service no respondió en 3 s → `pendiente` (el fichaje no se bloquea;
  se puede volver a verificar después con el `PUT`). Esto aplica el manejo
  de errores y timeouts de la sección 4.4.

## Ejemplo

```http
POST /api/v1/teams
{ "name": "Halcones FC", "categoryId": 1 }

POST /api/v1/teams/1/players
{ "name": "Juan Perez", "birthDate": "2010-05-14", "jerseyNumber": 10 }
```

Documentación interactiva: `http://localhost:3004/docs`
