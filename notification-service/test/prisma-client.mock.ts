// Doble de @prisma/client para los tests unitarios: no se conecta a ninguna base de datos.
export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}
