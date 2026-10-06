# =====================================================================
#  DEMO SportsLeague: los 8 microservicios a traves del API Gateway
#  Copia y pega cada bloque en PowerShell, en orden, mientras
#  "docker compose up" sigue corriendo en otra terminal.
#  (Empezar con la base vacia: docker compose down -v ; docker compose up)
# =====================================================================

# ---------------------------------------------------------------------
# BLOQUE 0 - URL del gateway y funciones de ayuda (pegalo primero)
# Deja localhost para Docker local. Para Render, usa la URL publica del
# API Gateway terminada en /api/v1.
# ---------------------------------------------------------------------
$API = "http://localhost:8080/api/v1"
$TOKEN = $null

# Envia JSON con el token de la sesion y, si hay error, muestra el mensaje del servicio.
function Send-Json($path, $body, $method = "Post") {
  try {
    $headers = @{}
    if ($script:TOKEN) { $headers.Authorization = "Bearer $script:TOKEN" }
    $json = if ($null -ne $body) { $body | ConvertTo-Json -Depth 6 } else { $null }
    Invoke-RestMethod -Uri "$API$path" -Method $method -ContentType "application/json" -Body $json -Headers $headers
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "ERROR $status`: $($_.ErrorDetails.Message)" -ForegroundColor Red
  }
}
function Get-Json($path) { Send-Json $path $null "Get" }
function Login($email, $password) {
  $s = Send-Json "/auth/login" @{ email = $email; password = $password }
  $script:TOKEN = $s.accessToken
  $s.user
}
$HOY = (Get-Date).ToString("yyyy-MM-dd")

# ---------------------------------------------------------------------
# BLOQUE 1 - Estado de los 8 servicios (a traves del gateway)
# ---------------------------------------------------------------------
docker compose ps --format "table {{.Name}}\t{{.Status}}"   # solo con Docker local
(Get-Json "/health/services").services | Format-Table name, status, database, redis, latencyMs

# ---------------------------------------------------------------------
# BLOQUE 2 - Seguridad: sin token no se puede escribir (401)
# ---------------------------------------------------------------------
Send-Json "/leagues" @{ name = "Liga pirata"; sport = "futbol" }   # -> 401
Login "admin@sportsleague.co" "admin12345"                         # organizador inicial

# ---------------------------------------------------------------------
# BLOQUE 3 - League Service: liga, temporada, categoria y reglamento
# ---------------------------------------------------------------------
$liga      = Send-Json "/leagues" @{ name = "Liga Municipal de Monteria"; sport = "futbol" }
$temporada = Send-Json "/leagues/$($liga.id)/seasons" @{ year = 2026; startDate = $HOY; endDate = (Get-Date).AddDays(150).ToString("yyyy-MM-dd") }
$categoria = Send-Json "/seasons/$($temporada.id)/categories" @{ name = "Sub-17"; ageRange = "15-17" }
Send-Json "/categories/$($categoria.id)/rules" @{ pointsWin = 3; pointsDraw = 1; tiebreakerCriteria = "diferencia_de_goles" } "Put"

# ---------------------------------------------------------------------
# BLOQUE 4 - Team Service: 4 equipos y jugadores
# Al fichar, el Team Service consulta el age_range al League Service (SINCRONO).
# ---------------------------------------------------------------------
$nacido16 = (Get-Date).AddYears(-16).AddDays(-30).ToString("yyyy-MM-dd")
$equipos = "Halcones FC", "Tigres United", "Leones del Sur", "Aguilas Doradas" | ForEach-Object {
  Send-Json "/teams" @{ name = $_; categoryId = $categoria.id }
}
$jugadores = @{}
foreach ($e in $equipos) {
  $jugadores[$e.id] = 9, 10 | ForEach-Object { Send-Json "/teams/$($e.id)/players" @{ name = "Jugador $_ de $($e.name)"; birthDate = $nacido16; jerseyNumber = $_ } }
}
Send-Json "/teams/$($equipos[0].id)/players" @{ name = "Mayor de edad"; birthDate = "2005-03-02"; jerseyNumber = 7 }   # -> no_elegible
Get-Json "/teams?categoryId=$($categoria.id)" | ForEach-Object { $_.players } | Format-Table name, jerseyNumber, eligibilityStatus

# ---------------------------------------------------------------------
# BLOQUE 5 - Referee Service: dos arbitros (disponibles toda la semana) y sus cuentas
# ---------------------------------------------------------------------
$dias = "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"
$arb1 = Send-Json "/referees" @{ zone = "monteria-norte"; categoriesCertified = @($categoria.id); availability = $dias }
$arb2 = Send-Json "/referees" @{ zone = "monteria-norte"; categoriesCertified = @($categoria.id); availability = $dias }
Send-Json "/auth/users" @{ name = "Arbitro Uno"; email = "arbitro1.demo$($liga.id)@sportsleague.co"; password = "arbitro123"; role = "arbitro"; refereeId = $arb1.id }
Send-Json "/auth/users" @{ name = "Arbitro Dos"; email = "arbitro2.demo$($liga.id)@sportsleague.co"; password = "arbitro123"; role = "arbitro"; refereeId = $arb2.id }

# ---------------------------------------------------------------------
# BLOQUE 6 - Fixture Service: calendario con la primera jornada HOY
#   SINCRONO:  Fixture -> League (reglamento) y Fixture -> Team (equipos)
#   ASINCRONO: fixture.published por jornada -> Referee, Live Score, Statistics, Notification
# ---------------------------------------------------------------------
$fixture = Send-Json "/seasons/$($temporada.id)/fixtures/generate" @{
  categoryId = $categoria.id
  zone       = "monteria-norte"
  teamIds    = @($equipos.id)
  venues     = @("Cancha Municipal 1", "Cancha Municipal 2")
  startDate  = $HOY
}
$fixture.matches | Format-Table id, homeTeam, awayTeam, venue, scheduledAt, status
Start-Sleep -Seconds 2
(Get-Json "/standings/$($temporada.id)").standings | Format-Table   # equipos en 0 puntos (Statistics consumio fixture.published)

# ---------------------------------------------------------------------
# BLOQUE 7 - El arbitro 1 entra, ve las asignaciones que el Referee Service
# creo SOLO (por fixture.published) y confirma la primera
# ---------------------------------------------------------------------
Login "arbitro1.demo$($liga.id)@sportsleague.co" "arbitro123"
$asignaciones = Get-Json "/referees/$($arb1.id)/assignments"
$asignaciones | Format-Table
Send-Json "/assignments/$($asignaciones[0].id)/confirm" $null "Put"
$partido = Get-Json "/matches/$($asignaciones[0].matchId)"
$partido

# ---------------------------------------------------------------------
# BLOQUE 8 - Live Score Service: goles y tarjetas en vivo
# Abre http://localhost:3000/partidos/<id del partido> en el navegador para ver
# el marcador cambiar por WebSocket mientras corres estas lineas.
# ---------------------------------------------------------------------
$local = $jugadores[$partido.homeTeam]; $visita = $jugadores[$partido.awayTeam]
Send-Json "/matches/$($partido.id)/events" @{ type = "gol"; minute = 12; teamId = $partido.homeTeam; playerId = $local[0].id }
Send-Json "/matches/$($partido.id)/events" @{ type = "tarjeta_amarilla"; minute = 30; teamId = $partido.awayTeam; playerId = $visita[1].id }
Send-Json "/matches/$($partido.id)/events" @{ type = "gol"; minute = 55; teamId = $partido.homeTeam; playerId = $local[1].id }
Send-Json "/matches/$($partido.id)/events" @{ type = "gol"; minute = 70; teamId = $partido.awayTeam; playerId = $visita[0].id }
(Get-Json "/matches/$($partido.id)/live").score
(Get-Json "/matches/$($partido.id)").status            # en_curso (Fixture consumio match.event)

# Permisos (10.2): el arbitro 1 NO puede registrar eventos en un partido que no tiene asignado
$otro = ($fixture.matches | Where-Object { $_.id -notin $asignaciones.matchId })[0]
Send-Json "/matches/$($otro.id)/events" @{ type = "gol"; minute = 1; teamId = $otro.homeTeam }   # -> 403

# ---------------------------------------------------------------------
# BLOQUE 9 - Cierre del partido: match.completed -> Statistics recalcula
# ---------------------------------------------------------------------
Send-Json "/matches/$($partido.id)/complete" $null
Start-Sleep -Seconds 2
(Get-Json "/standings/$($temporada.id)").standings | Format-Table position, teamId, played, wins, draws, losses, goalsFor, goalsAgainst, points
Get-Json "/top-scorers/$($temporada.id)" | Format-Table
Get-Json "/players/$($visita[1].id)/disciplinary-record"
(Get-Json "/matches/$($partido.id)").status            # finalizado

# Idempotencia (4.3): reenviar el acta NO duplica puntos ni goles
Send-Json "/matches/$($partido.id)/complete" $null
Start-Sleep -Seconds 2
(Get-Json "/standings/$($temporada.id)").standings | Format-Table position, teamId, played, points

# ---------------------------------------------------------------------
# BLOQUE 10 - Notification Service: un espectador sigue a su equipo
# ---------------------------------------------------------------------
$fan = Send-Json "/auth/register" @{ name = "Hincha"; email = "hincha$(Get-Random)@correo.com"; password = "hincha-clave" }
$TOKEN = $fan.accessToken
Send-Json "/notifications/preferences" @{ userId = $fan.user.id; followedTeams = @($partido.homeTeam); channels = @("push") } "Put"
(Get-Json "/notifications/$($fan.user.id)").notifications | Format-Table type, title, body
Get-Json "/notifications/1"                             # -> 403: no son sus notificaciones

# ---------------------------------------------------------------------
# BLOQUE 11 - Analytics Service: ETL sobre replicas de solo lectura
# ---------------------------------------------------------------------
Login "admin@sportsleague.co" "admin12345"
Send-Json "/matches/$($otro.id)/suspend" @{ reason = "Tormenta electrica" }
Send-Json "/analytics/etl/run" $null
Get-Json "/analytics/summary"
(Get-Json "/analytics/suspended-matches?seasonId=$($temporada.id)").matches
(Get-Json "/analytics/team-trend/$($partido.homeTeam)").points | Format-Table

# =====================================================================
#  OPCIONAL - Resiliencia (documento, 4.4). Solo con Docker local.
# =====================================================================

# --- A) League Service caido al fichar un jugador -> queda "pendiente"
docker stop sportsleague-league-service
$p = Send-Json "/teams/$($equipos[0].id)/players" @{ name = "Fichaje tardio"; birthDate = $nacido16; jerseyNumber = 5 }
$p.eligibilityStatus                    # pendiente
docker start sportsleague-league-service
Start-Sleep -Seconds 12
(Send-Json "/players/$($p.id)/eligibility" $null "Put").eligibilityStatus   # elegible

# --- B) Team Service caido al generar un calendario -> reintentos y circuit breaker
$temporada2 = Send-Json "/leagues/$($liga.id)/seasons" @{ year = 2027; startDate = "2027-03-01"; endDate = "2027-07-31" }
docker stop sportsleague-team-service
$cuerpo = @{ categoryId = $categoria.id; zone = "monteria-norte"; teamIds = @($equipos.id); venues = @("Cancha Municipal 1", "Cancha Municipal 2"); startDate = "2027-03-06" }
1..3 | ForEach-Object { Send-Json "/seasons/$($temporada2.id)/fixtures/generate" $cuerpo }
#   -> 3 veces: "Team Service no respondio despues de 3 intentos" (503)
Send-Json "/seasons/$($temporada2.id)/fixtures/generate" $cuerpo
#   -> al instante: "circuit breaker abierto" (503), sin tocar la red
docker start sportsleague-team-service
Start-Sleep -Seconds 25
Send-Json "/seasons/$($temporada2.id)/fixtures/generate" $cuerpo   # ahora funciona

# --- C) Rate limiting (5.3): mas de 120 escrituras por minuto desde la misma IP -> 429
1..125 | ForEach-Object { Send-Json "/auth/login" @{ email = "x@x.co"; password = "x" } } | Out-Null
