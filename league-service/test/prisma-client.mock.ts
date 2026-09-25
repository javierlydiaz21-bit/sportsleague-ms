// Doble de @prisma/client para los tests unitarios: no se conecta a ninguna base de datos.
export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}

export const EligibilityStatus = {
  elegible: 'elegible',
  no_elegible: 'no_elegible',
  pendiente: 'pendiente',
} as const;
export type EligibilityStatus = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];

export const MatchStatus = {
  programado: 'programado',
  en_curso: 'en_curso',
  finalizado: 'finalizado',
  suspendido: 'suspendido',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];
