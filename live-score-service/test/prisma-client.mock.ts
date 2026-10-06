// Doble de @prisma/client para los tests unitarios: no se conecta a ninguna base de datos.
export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}

export const EventType = {
  gol: 'gol',
  tarjeta_amarilla: 'tarjeta_amarilla',
  tarjeta_roja: 'tarjeta_roja',
  sustitucion: 'sustitucion',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const LiveStatus = {
  programado: 'programado',
  en_curso: 'en_curso',
  finalizado: 'finalizado',
  suspendido: 'suspendido',
} as const;
export type LiveStatus = (typeof LiveStatus)[keyof typeof LiveStatus];
