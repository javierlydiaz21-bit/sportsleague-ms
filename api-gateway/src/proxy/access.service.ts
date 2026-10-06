import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { serviceUrl } from '../config/services';
import { MatchedRoute } from './routes';

interface Assignment {
  id: number;
  matchId: number;
}

/**
 * Autorizacion por ruta (documento 5.2 y 10.2). Para los arbitros se cruzan sus
 * asignaciones vigentes en el Referee Service: solo pueden registrar eventos de
 * los partidos que tienen asignados.
 */
@Injectable()
export class AccessService {
  private readonly timeoutMs = 5000;

  /** Asignaciones del arbitro, consultadas al Referee Service. */
  async assignmentsOf(refereeId: number): Promise<Assignment[]> {
    try {
      const res = await fetch(`${serviceUrl('referee')}/api/v1/referees/${refereeId}/assignments`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Assignment[];
    } catch {
      throw new ServiceUnavailableException('Referee Service no disponible: no se pueden verificar las asignaciones');
    }
  }

  async authorize(matched: MatchedRoute, user: AuthUser | null, body: any): Promise<void> {
    const { access } = matched.route;
    if (access === 'public') return;
    if (!user) throw new UnauthorizedException('Falta el token de acceso (Authorization: Bearer)');
    if (user.role === Role.organizador) return; // el organizador administra toda la liga

    const denied = (msg: string) => new ForbiddenException(msg);
    switch (access) {
      case 'auth':
        return;
      case 'organizador':
        throw denied('Solo un organizador puede hacer esta operacion');
      case 'own-referee':
        if (user.role === Role.arbitro && user.refereeId === matched.id) return;
        throw denied('Solo puede consultar o modificar sus propios datos de arbitro');
      case 'own-assignment': {
        if (user.role !== Role.arbitro || !user.refereeId) throw denied('Solo el arbitro asignado puede confirmar');
        const own = await this.assignmentsOf(user.refereeId);
        if (own.some((a) => a.id === matched.id)) return;
        throw denied(`La asignacion ${matched.id} no es suya`);
      }
      case 'assigned-referee': {
        if (user.role !== Role.arbitro || !user.refereeId) {
          throw denied('Solo el arbitro asignado o un organizador pueden registrar eventos en vivo');
        }
        const own = await this.assignmentsOf(user.refereeId);
        if (own.some((a) => a.matchId === matched.id)) return;
        throw denied(`No tiene asignado el partido ${matched.id}`);
      }
      case 'own-user':
        if (user.sub === matched.id) return;
        throw denied('Solo puede ver sus propias notificaciones');
      case 'own-user-body':
        if (body?.userId === user.sub) return;
        throw denied('Solo puede modificar sus propias preferencias');
    }
  }
}
