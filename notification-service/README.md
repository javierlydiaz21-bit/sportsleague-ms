# Notification Service — SportsLeague (documento, sección 2.7)

Escucha los eventos de programación de calendario y de resultado final para
informar a equipos y espectadores interesados: horarios confirmados, cambios
de sede de último momento y resultados finales.

## Conformidad con el documento de arquitectura

| Elemento | Documento | Implementado |
|---|---|---|
| Lenguaje | NestJS + Prisma (opcional, solo preferencias) | NestJS + Prisma ✅ |
| Base de datos | Tabla ligera de preferencias de usuario | `notification_preferences` ✅ + `notifications` (ver nota) |
| Comunicación (2.7) | Asíncrona (eventos) en su totalidad | ✅ |
| Eventos (2.7) | Consume `fixture.published` y `match.completed` | ✅ + `fixture.venue_changed` y `match.suspended` |

**Nota:** la tabla `notifications` guarda los avisos generados para que
`GET /notifications/{userId}` pueda mostrarlos. Cada aviso tiene una clave
única del hecho notificado (por ejemplo `resultado:12`): si el mismo evento
llega dos veces, o llega un acta corregida, se actualiza el aviso en vez de
duplicarlo (idempotencia, documento 1.5).

**Cambios de sede:** el documento pide avisar los "cambios de sede de último
momento", pero `fixture.published` solo se emite al publicar una jornada.
Por eso el Fixture Service publica además `fixture.venue_changed` cuando
cambia la sede de un partido (`PUT /matches/{id}/venue`).

## Endpoints (documento, 2.7)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/v1/notifications/{userId}` | Avisos del usuario y sus preferencias |
| PUT | `/api/v1/notifications/preferences` | Equipos que sigue y canales (push, email) |
| POST | `/api/v1/notifications/test` | Envía un aviso de prueba |

Sin equipos seguidos, el usuario ve los avisos de toda la liga. Más
`GET /api/v1/health`, `GET /api/v1/status` y la documentación en `/docs`.

## Eventos consumidos

| Evento | Aviso |
|---|---|
| `fixture.published` | Horario confirmado de cada partido de la jornada |
| `fixture.venue_changed` | Cambio de sede |
| `match.completed` | Resultado final (o "acta corregida") |
| `match.suspended` | Partido suspendido y su motivo |

Para redactar el aviso con el nombre de los equipos hace una consulta REST
puntual al Team Service (documento 3.8); si no responde, usa "Equipo {id}".
El envío real por push o correo queda fuera del alcance del proyecto: cada
envío se registra en el log con el canal y el usuario.

Documentación interactiva: `http://localhost:3007/docs`
