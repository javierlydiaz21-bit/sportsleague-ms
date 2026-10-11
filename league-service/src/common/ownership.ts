import { ForbiddenException } from '@nestjs/common';

/** Usuario autenticado que reenvia el API Gateway (x-user-id); null si no viene o no es valido. */
export function userIdOf(header?: string): number | null {
  const id = Number(header);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Solo el organizador que creo la liga puede corregir sus datos. Las ligas anteriores al
 * propietario (owner_id NULL) quedan como hasta ahora hasta que se asigne su propietario
 * (fase de propiedad de las ligas).
 */
export function assertCanEdit(league: { ownerId: number | null }, userId: number | null) {
  if (league.ownerId !== null && league.ownerId !== userId) {
    throw new ForbiddenException('Solo el organizador que creo la liga puede editarla');
  }
}
