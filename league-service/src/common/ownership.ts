import { ForbiddenException } from '@nestjs/common';

/** Usuario autenticado que reenvia el API Gateway (x-user-id); null si no viene o no es valido. */
export function userIdOf(header?: string): number | null {
  const id = Number(header);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Quien hace la peticion, segun las cabeceras que agrega el API Gateway. */
export interface Actor {
  id: number | null;
  /** Administrador de la plataforma (x-user-admin: true): administra las ligas sin propietario. */
  admin: boolean;
}

export function actorOf(userId?: string, admin?: string): Actor {
  return { id: userIdOf(userId), admin: admin === 'true' };
}

/**
 * Solo el organizador que creo la liga puede modificarla. Las ligas anteriores al propietario
 * (owner_id NULL) solo las administra el administrador de la plataforma, hasta que se les
 * asigne un propietario.
 */
export function assertCanEdit(league: { ownerId: number | null }, actor: Actor) {
  if (league.ownerId === null) {
    if (!actor.admin) {
      throw new ForbiddenException('Esta liga aun no tiene propietario: solo la administra el administrador de la plataforma');
    }
    return;
  }
  if (league.ownerId !== actor.id) {
    throw new ForbiddenException('Solo el organizador que creo la liga puede modificarla');
  }
}
