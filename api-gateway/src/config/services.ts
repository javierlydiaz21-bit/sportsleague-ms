export type ServiceKey =
  | 'league'
  | 'team'
  | 'fixture'
  | 'referee'
  | 'liveScore'
  | 'statistics'
  | 'notification'
  | 'analytics';

/** Microservicios internos detras del gateway (documento 5.1). */
export const SERVICES: Record<ServiceKey, { name: string; env: string; local: string }> = {
  league: { name: 'League Service', env: 'LEAGUE_SERVICE_URL', local: 'http://localhost:3003' },
  team: { name: 'Team Service', env: 'TEAM_SERVICE_URL', local: 'http://localhost:3004' },
  fixture: { name: 'Fixture Service', env: 'FIXTURE_SERVICE_URL', local: 'http://localhost:3001' },
  referee: { name: 'Referee Service', env: 'REFEREE_SERVICE_URL', local: 'http://localhost:3002' },
  liveScore: { name: 'Live Score Service', env: 'LIVE_SCORE_SERVICE_URL', local: 'http://localhost:3005' },
  statistics: { name: 'Statistics Service', env: 'STATISTICS_SERVICE_URL', local: 'http://localhost:3006' },
  notification: { name: 'Notification Service', env: 'NOTIFICATION_SERVICE_URL', local: 'http://localhost:3007' },
  analytics: { name: 'Analytics Service', env: 'ANALYTICS_SERVICE_URL', local: 'http://localhost:3008' },
};

export function serviceUrl(key: ServiceKey): string {
  const s = SERVICES[key];
  return (process.env[s.env] || s.local).replace(/\/+$/, '');
}
