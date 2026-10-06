// Doble de @prisma/client para los tests unitarios: no se conecta a ninguna base de datos.
export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}

export const Role = {
  organizador: 'organizador',
  arbitro: 'arbitro',
  espectador: 'espectador',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
