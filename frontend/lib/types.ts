// Formas de las respuestas de los microservicios (a traves del API Gateway).

export type Role = "organizador" | "arbitro" | "espectador";
export type MatchStatus = "programado" | "en_curso" | "finalizado" | "suspendido";
export type EventType = "gol" | "tarjeta_amarilla" | "tarjeta_roja" | "sustitucion";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  refereeId: number | null;
}

export interface Rule {
  id: number;
  categoryId: number;
  pointsWin: number;
  pointsDraw: number;
  tiebreakerCriteria: string;
}
export interface Category {
  id: number;
  leagueId: number;
  name: string;
  ageRange: string;
  rule: Rule | null;
}
export interface Season {
  id: number;
  leagueId: number;
  year: number;
  startDate: string;
  endDate: string;
}
export interface League {
  id: number;
  name: string;
  sport: string;
  seasons: Season[];
  categories: Category[];
}

export interface Player {
  id: number;
  teamId: number;
  name: string | null;
  birthDate: string;
  eligibilityStatus: "elegible" | "no_elegible" | "pendiente";
  jerseyNumber: number;
}
export interface Team {
  id: number;
  name: string;
  categoryId: number;
  players?: Player[];
}

export interface Match {
  id: number;
  seasonId: number;
  homeTeam: number;
  awayTeam: number;
  venue: string;
  scheduledAt: string;
  status: MatchStatus;
}

export interface MatchEvent {
  id: number;
  matchId: number;
  type: EventType;
  minute: number;
  teamId: number;
  playerId: number | null;
}
export interface LiveMatch {
  matchId: number;
  seasonId: number;
  categoryId: number;
  homeTeam: number;
  awayTeam: number;
  status: MatchStatus;
  suspensionReason: string | null;
  peakViewers: number;
  completedAt: string | null;
  score: { home: number; away: number };
  events: MatchEvent[];
  viewers?: number;
}

export interface Referee {
  id: number;
  zone: string;
  categoriesCertified: number[];
  availability: string[];
  _count?: { assignments: number };
}
export interface Assignment {
  id: number;
  matchId: number;
  refereeId: number;
  confirmed: boolean;
}

export interface StandingRow {
  position: number;
  teamId: number;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}
export interface Standings {
  seasonId: number;
  tiebreakerCriteria: string;
  standings: StandingRow[];
  cached: boolean;
}
export interface TopScorer {
  position: number;
  seasonId: number;
  playerId: number;
  goals: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  matchId: number | null;
  createdAt: string;
}
export interface NotificationFeed {
  userId: number;
  preferences: { followedTeams: number[]; channels: string[] };
  notifications: Notification[];
}

export interface ServiceHealth {
  key: string;
  name: string;
  status: string;
  database?: string;
  redis?: string;
  latencyMs: number;
}
