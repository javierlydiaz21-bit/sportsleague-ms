# Referee Service — SportsLeague (documento, sección 2.4)

Gestiona el registro de árbitros disponibles, su disponibilidad horaria
declarada y la asignación automática a partidos según la categoría del
encuentro y la zona geográfica del árbitro.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma | NestJS + Prisma ✅ |
| Base de datos | Referee DB (PostgreSQL) | `referee_db` (PostgreSQL 16) ✅ |
| Tabla `referees` | id, zone, categories_certified | id, zone, categories_certified **+ availability** (ver nota) |
| Tabla `referee_assignments` | match_id, referee_id, confirmed | id, match_id, referee_id, confirmed ✅ |
| Índices (3.4) | referees.zone · referee_assignments.match_id | los dos ✅ |
| Restricciones (3.4) | zone NOT NULL · (match_id, referee_id) único · confirmed por defecto false | todas ✅ |
| Comunicación (2.4) | Asíncrona: reacciona a eventos de programación de calendario | ✅ |
| Eventos (2.4) | Consume `fixture.published` para asignar árbitros automáticamente | ✅ |

**Nota sobre `availability`:** el documento pide gestionar la
*disponibilidad horaria declarada* y define el endpoint
`PUT /referees/{id}/availability`, pero la tabla `referees` no tiene dónde
guardarla. Es la única columna agregada. Guarda los días en que el árbitro
declara estar disponible, por ejemplo `{sabado,domingo}`.

## Endpoints (documento, 2.4)

| Método | Ruta |
|---|---|
| POST | `/api/v1/referees` |
| PUT  | `/api/v1/referees/{id}/availability` |
| GET  | `/api/v1/referees/{id}/assignments` |
| PUT  | `/api/v1/assignments/{id}/confirm` |

Más `GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

## Asignación automática (evento `fixture.published`)

Por cada partido de la jornada recibida, se busca un árbitro que cumpla
todo esto:

- Es de la misma **zona** del evento.
- Está **certificado** para la categoría del partido.
- Está **disponible** el día del partido.
- No tiene ya otro partido **en esa misma jornada**.

Entre los que cumplen, se elige al que tiene menos asignaciones. La
asignación queda con `confirmed = false` hasta que el árbitro la confirma.

El proceso es idempotente: si el partido ya tiene árbitro, no se crea otra
asignación. Además, la restricción única `(match_id, referee_id)` lo
respalda en la base de datos.

## Ejemplo

```http
POST /api/v1/referees
{ "zone": "monteria-norte", "categoriesCertified": [1], "availability": ["sabado", "domingo"] }
```

`categoriesCertified` guarda los **ids** de las categorías del League
Service. Entre servicios solo se comparten identificadores (documento, 3.8).

Documentación interactiva: `http://localhost:3002/docs`
