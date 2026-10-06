# SportsLeague — Plataforma de gestión de ligas deportivas amateur

Implementación del documento *SportsLeague: Diseño Arquitectónico y Estrategia
DevOps del Sistema*: ocho microservicios NestJS con una base de datos
PostgreSQL cada uno, un API Gateway, comunicación por REST y por eventos en
Redis Pub/Sub, marcador en vivo por WebSocket y una web en Next.js.

```
Navegador (Next.js) ──HTTP + WebSocket──▶ API Gateway :8080 ──▶ microservicios
                                           JWT · roles · rate limiting · logs

 League :3003 ◀─REST── Team :3004            Redis Pub/Sub
     ▲   ▲                ▲                  ─────────────
     │   └─REST── Fixture :3001 ──fixture.published──▶ Referee :3002
     │                    ▲   (y venue_changed)    ──▶ Live Score, Statistics, Notification
     └─REST── Statistics :3006
                          ▲
 Live Score :3005 ──match.event / match.completed / match.suspended──▶ Statistics,
     (WebSocket /live-scores)                       Notification, Fixture
 Analytics :3008 ── ETL periódico sobre réplicas de solo lectura (Fixture, Live Score, Statistics)
```

| Servicio | Puerto | Base de datos | Documento |
|---|---|---|---|
| [API Gateway](api-gateway/README.md) | 8080 | `gateway_db` (usuarios y sesiones) | 5 |
| [Fixture Service](fixture-service/README.md) | 3001 | `fixture_db` | 2.3 |
| [Referee Service](referee-service/README.md) | 3002 | `referee_db` | 2.4 |
| [League Service](league-service/README.md) | 3003 | `league_db` | 2.2 |
| [Team Service](team-service/README.md) | 3004 | `team_db` | 2.1 |
| [Live Score Service](live-score-service/README.md) | 3005 | `live_score_db` | 2.5 |
| [Statistics Service](statistics-service/README.md) | 3006 | `statistics_db` | 2.6 |
| [Notification Service](notification-service/README.md) | 3007 | `notification_db` | 2.7 |
| [Analytics Service](analytics-service/README.md) | 3008 | `analytics_db` | 2.8 |
| [Frontend](frontend) (Next.js) | 3000 | — | 8.1 |

Cada servicio tiene su propio README con la tabla de conformidad con el
documento y su documentación interactiva en `http://localhost:<puerto>/docs`.

## Levantar todo en local

Requisitos: Docker Desktop y Node.js 20 o superior.

```bash
# 1. Backend: 9 servicios, 9 bases de datos y Redis (la primera vez tarda varios minutos)
docker compose up --build

# 2. Frontend, en otra terminal
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Para empezar con las bases vacías: `docker compose down -v` y luego
`docker compose up`. Con `docker compose --profile observability up` se
levantan además Prometheus (`:9090`) y Grafana (`:3010`, con el tablero
"SportsLeague — Jornada en vivo").

## Recorrido de demostración

1. Entra a `http://localhost:3000/login` como organizador:
   `admin@sportsleague.co` / `admin12345`.
2. En **Organizador**, pulsa **Cargar liga de ejemplo**: crea la liga, la
   temporada, la categoría con su reglamento, 4 equipos con jugadores, 2
   árbitros con cuenta y el calendario, con la primera jornada hoy.
3. Abre la temporada desde **Inicio**: calendario, tabla y goleadores.
4. Abre un partido de hoy en dos ventanas: en una, como organizador (o como
   el árbitro asignado: `arbitro1@sportsleague.co` / `arbitro123`), registra
   goles y tarjetas; en la otra, sin sesión, el marcador cambia al instante.
5. **Finaliza el partido**: la tabla de posiciones y los goleadores se
   recalculan solos, el calendario lo marca como finalizado y llega el aviso
   del resultado a **Notificaciones**.
6. En **Analítica**, pulsa **Ejecutar ETL ahora** para ver asistencia
   estimada, suspendidos y la evolución de puntos de cada equipo.

El archivo [`demo/demo.ps1`](demo/demo.ps1) hace el mismo recorrido desde
PowerShell, llamando al API Gateway.

## Pruebas

Cada servicio tiene lint (ESLint) y pruebas unitarias (Jest):

```bash
cd <servicio>
npm ci
npx prisma generate
npm run lint
npm test
```

## CI/CD y despliegue (documento, secciones 7 y 8)

- **Backend:** [`.github/workflows/backend.yml`](.github/workflows/backend.yml)
  corre por servicio: instalación, lint, tests, build, imagen Docker, push a
  GHCR y deploy a Render (solo con push a `main`) mediante el secret
  `RENDER_DEPLOY_HOOK_<SERVICIO>`.
- **Frontend:** Vercel despliega `main` y un preview por pull request.
  Variable: `NEXT_PUBLIC_API_URL` con la URL pública del API Gateway.
- **Bases de datos en Render:** una instancia de Postgres con una base por
  servicio ([`infra/crear-bases-render.sql`](infra/crear-bases-render.sql)).
- **Solo el API Gateway debe ser público.** Los demás servicios van en la red
  privada de Render, y el gateway los encuentra por las variables
  `*_SERVICE_URL`. En el gateway configura además `JWT_SECRET`,
  `ADMIN_PASSWORD` y `CORS_ORIGINS` (la URL de Vercel).
