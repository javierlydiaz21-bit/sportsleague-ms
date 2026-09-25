# =====================================================================
#  DEMO SportsLeague: Team, League, Fixture y Referee Service
#  Copia y pega cada bloque en PowerShell, en orden, mientras
#  "docker compose up" sigue corriendo en otra terminal.
#  (Empezar con la base vacia: docker compose down -v ; docker compose up)
# =====================================================================

# ---------------------------------------------------------------------
# BLOQUE 0 - URLs y funcion de ayuda (pegalo primero)
# Deja localhost para Docker local. Para probar en Render, reemplaza por
# las URLs publicas de tus servicios (terminadas en /api/v1).
# ---------------------------------------------------------------------
$FIXTURE = "http://localhost:3001/api/v1"
$REFEREE = "http://localhost:3002/api/v1"
$LEAGUE  = "http://localhost:3003/api/v1"
$TEAM    = "http://localhost:3004/api/v1"

# ---------------------------------------------------------------------
# Funcion de ayuda
# Envia JSON y, si el servicio responde con error, muestra su mensaje.
# ---------------------------------------------------------------------
function Send-Json($url, $body, $method = "Post") {
  try {
    $json = if ($body) { $body | ConvertTo-Json -Depth 5 } else { $null }
    Invoke-RestMethod -Uri $url -Method $method -ContentType "application/json" -Body $json
  } catch {
    Write-Host "ERROR: $($_.ErrorDetails.Message)" -ForegroundColor Red
  }
}

# ---------------------------------------------------------------------
# BLOQUE 1 - Los 9 contenedores y la salud de los 4 servicios
# ---------------------------------------------------------------------
docker compose ps                        # solo con Docker local
$FIXTURE, $REFEREE, $LEAGUE, $TEAM | ForEach-Object { Invoke-RestMethod "$_/health" } | Format-Table

# ---------------------------------------------------------------------
# BLOQUE 2 - League Service: liga, temporada, categoria y reglamento
# ---------------------------------------------------------------------
$liga      = Send-Json "$LEAGUE/leagues" @{ name = "Liga Municipal de Monteria"; sport = "futbol" }
$temporada = Send-Json "$LEAGUE/leagues/$($liga.id)/seasons" @{ year = 2026; startDate = "2026-10-01"; endDate = "2027-02-28" }
$categoria = Send-Json "$LEAGUE/seasons/$($temporada.id)/categories" @{ name = "Sub-17"; ageRange = "15-17" }
Send-Json "$LEAGUE/categories/$($categoria.id)/rules" @{ pointsWin = 3; pointsDraw = 1; tiebreakerCriteria = "diferencia_de_goles" } "Put"
$liga; $temporada; $categoria

# ---------------------------------------------------------------------
# BLOQUE 3 - Team Service: 4 equipos y dos jugadores
# Al fichar, el Team Service consulta el age_range al League Service
# (comunicacion SINCRONA) y calcula la elegibilidad.
# ---------------------------------------------------------------------
$equipos = "Halcones FC", "Tigres United", "Leones del Sur", "Aguilas Doradas" | ForEach-Object {
  Send-Json "$TEAM/teams" @{ name = $_; categoryId = $categoria.id }
}
$equipos | Format-Table

$eq1 = $equipos[0].id
Send-Json "$TEAM/teams/$eq1/players" @{ birthDate = "2010-05-14"; jerseyNumber = 10 }   # 16 anios -> elegible
Send-Json "$TEAM/teams/$eq1/players" @{ birthDate = "2005-03-02"; jerseyNumber = 7 }    # 21 anios -> no_elegible
Invoke-RestMethod "$TEAM/teams/$eq1/players" | Format-Table

# ---------------------------------------------------------------------
# BLOQUE 4 - Referee Service: dos arbitros de la zona
# ---------------------------------------------------------------------
$arb1 = Send-Json "$REFEREE/referees" @{ zone = "monteria-norte"; categoriesCertified = @($categoria.id); availability = @("sabado", "domingo") }
$arb2 = Send-Json "$REFEREE/referees" @{ zone = "monteria-norte"; categoriesCertified = @($categoria.id); availability = @("sabado") }
$arb1; $arb2

# ---------------------------------------------------------------------
# BLOQUE 5 - Fixture Service: generar el calendario (2026-10-03 es sabado)
#   SINCRONO:  Fixture -> League (reglamento) y Fixture -> Team (equipos)
#   ASINCRONO: publica fixture.published por cada jornada
# ---------------------------------------------------------------------
$fixture = Send-Json "$FIXTURE/seasons/$($temporada.id)/fixtures/generate" @{
  categoryId = $categoria.id
  zone       = "monteria-norte"
  teamIds    = @($equipos.id)
  venues     = @("Cancha Municipal 1", "Cancha Municipal 2")
  startDate  = "2026-10-03"
}
$fixture.reglamento                     # vino del League Service
$fixture.equiposValidados | Format-Table # vino del Team Service
$fixture.matches | Format-Table id, homeTeam, awayTeam, venue, scheduledAt, status

# ---------------------------------------------------------------------
# BLOQUE 6 - Asignaciones creadas SOLAS por el evento fixture.published
# (nunca se llamo a un endpoint para asignar)
# ---------------------------------------------------------------------
Invoke-RestMethod "$REFEREE/referees/$($arb1.id)/assignments" | Format-Table
Invoke-RestMethod "$REFEREE/referees/$($arb2.id)/assignments" | Format-Table

# El arbitro confirma su primera asignacion
$asig = (Invoke-RestMethod "$REFEREE/referees/$($arb1.id)/assignments")[0]
Send-Json "$REFEREE/assignments/$($asig.id)/confirm" $null "Put"

# ---------------------------------------------------------------------
# BLOQUE 7 - Otros endpoints del documento
# ---------------------------------------------------------------------
Invoke-RestMethod "$FIXTURE/fixtures/$($temporada.id)" | Format-Table id, homeTeam, awayTeam, venue, scheduledAt
Invoke-RestMethod "$FIXTURE/matches/1"
Send-Json "$FIXTURE/matches/1/venue" @{ venue = "Estadio 18 de Junio" } "Put"
Invoke-RestMethod "$LEAGUE/categories/$($categoria.id)/rules"
Invoke-RestMethod "$TEAM/teams/$eq1"
Send-Json "$REFEREE/referees/$($arb2.id)/availability" @{ availability = @("sabado", "domingo") } "Put"

# =====================================================================
#  OPCIONAL - Resiliencia (documento, 4.4). Solo con Docker local,
#  porque usa docker stop / docker start.
# =====================================================================

# --- A) League Service caido al fichar un jugador -> queda "pendiente"
docker stop sportsleague-league-service
$p = Send-Json "$TEAM/teams/$eq1/players" @{ birthDate = "2010-08-20"; jerseyNumber = 5 }
$p                                      # eligibilityStatus = pendiente
docker start sportsleague-league-service
Start-Sleep -Seconds 12                 # espera a que vuelva a arrancar
Send-Json "$TEAM/players/$($p.id)/eligibility" $null "Put"   # ahora = elegible

# --- B) Team Service caido al generar un calendario -> reintentos y circuit breaker
$temporada2 = Send-Json "$LEAGUE/leagues/$($liga.id)/seasons" @{ year = 2027; startDate = "2027-03-01"; endDate = "2027-07-31" }
docker stop sportsleague-team-service
$cuerpo = @{ categoryId = $categoria.id; zone = "monteria-norte"; teamIds = @($equipos.id); venues = @("Cancha Municipal 1", "Cancha Municipal 2"); startDate = "2027-03-06" }
1..3 | ForEach-Object { Send-Json "$FIXTURE/seasons/$($temporada2.id)/fixtures/generate" $cuerpo }
#   -> 3 veces: "Team Service no respondio despues de 3 intentos" (503)
Send-Json "$FIXTURE/seasons/$($temporada2.id)/fixtures/generate" $cuerpo
#   -> al instante: "circuit breaker abierto" (503), sin tocar la red
docker start sportsleague-team-service
Start-Sleep -Seconds 25                 # arranque + los 20 s del circuito abierto
Send-Json "$FIXTURE/seasons/$($temporada2.id)/fixtures/generate" $cuerpo   # ahora funciona
