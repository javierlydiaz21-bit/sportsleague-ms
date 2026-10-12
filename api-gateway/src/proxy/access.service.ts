import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { isPlatformAdmin } from '../config/admin';
import { internalHeaders } from '../config/internal';
import { serviceUrl } from '../config/services';
import { OwnershipService } from '../ownership/ownership.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchedRoute } from './routes';

interface Assignment {
  id: number;
  matchId: number;
}

/**
 * Autorizacion por ruta (documento 5.2 y 10.2).
 *  - Cada organizador modifica solo sus ligas: para las escrituras se averigua a que liga
 *    pertenece el recurso y quien es su propietario (OwnershipService). Las ligas sin
 *    propietario solo las administra el administrador de la plataforma.
 *  - Para los arbitros se cruzan sus asignaciones vigentes en el Referee Service: solo pueden
 *    registrar eventos de los partidos que tienen asignados.
 */
@Injectable()
export class AccessService {
  private readonly timeoutMs = 5000;

  constructor(
    private readonly ownership: OwnershipService,
    private readonly prisma: PrismaService,
  ) {}

  /** Asignaciones del arbitro, consultadas al Referee Service. */
  async assignmentsOf(refereeId: number): Promise<Assignment[]> {
    try {
      const res = await fetch(`${serviceUrl('referee')}/api/v1/referees/${refereeId}/assignments`, {
        headers: internalHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Assignment[];
    } catch {
      throw new ServiceUnavailableException('Referee Service no disponible: no se pueden verificar las asignaciones');
    }
  }

  /** El organizador debe ser propietario de la liga del partido. */
  private async assertMatchOwner(matchId: number, user: AuthUser) {
    const seasonId = await this.ownership.matchSeason(matchId);
    this.ownership.assertOwner(await this.ownership.league('seasons', seasonId), user);
  }

  /** Despues de responder: una asignacion de propietario exitosa invalida la propiedad guardada. */
  afterResponse(matched: MatchedRoute, status: number): void {
    if (matched.route.access === 'admin-assign-owner' && status >= 200 && status < 300) this.ownership.forgetOwners();
  }

  async authorize(matched: MatchedRoute, user: AuthUser | null, body: any): Promise<void> {
    const { access } = matched.route;
    const id = matched.id as number;
    if (access === 'public') return;
    if (!user) throw new UnauthorizedException('Falta el token de acceso (Authorization: Bearer)');

    const denied = (msg: string) => new ForbiddenException(msg);
    const organizer = user.role === Role.organizador;
    const onlyOrganizers = () => {
      if (!organizer) throw denied('Solo un organizador puede hacer esta operacion');
    };

    switch (access) {
      case 'auth':
        return;
      case 'organizador':
        return onlyOrganizers();

      case 'admin-assign-owner': {
        if (!isPlatformAdmin(user)) throw denied('Solo el administrador de la plataforma asigna propietarios');
        const target = Number(body?.ownerId);
        const account = Number.isInteger(target) ? await this.prisma.user.findUnique({ where: { id: target } }) : null;
        if (!account || account.role !== Role.organizador) {
          throw new BadRequestException('ownerId debe ser el id de una cuenta de organizador');
        }
        return;
      }

      // Escrituras sobre una liga: solo su propietario (o el administrador si no tiene propietario)
      case 'owner-league':
        onlyOrganizers();
        return this.ownership.assertOwner(await this.ownership.league('leagues', id), user);
      case 'owner-season':
        onlyOrganizers();
        return this.ownership.assertOwner(await this.ownership.league('seasons', id), user);
      case 'owner-category':
        onlyOrganizers();
        return this.ownership.assertOwner(await this.ownership.league('categories', id), user);
      case 'owner-category-body': {
        onlyOrganizers();
        const categoryId = Number(body?.categoryId);
        if (!Number.isInteger(categoryId)) throw new BadRequestException('categoryId debe ser un numero entero');
        return this.ownership.assertOwner(await this.ownership.league('categories', categoryId), user);
      }
      case 'owner-team':
        onlyOrganizers();
        return this.ownership.assertOwner(await this.ownership.league('categories', await this.ownership.teamCategory(id)), user);
      case 'owner-player':
        onlyOrganizers();
        return this.ownership.assertOwner(await this.ownership.league('categories', await this.ownership.playerCategory(id)), user);
      case 'owner-match':
        onlyOrganizers();
        return this.assertMatchOwner(id, user);
      case 'owner-referee-body': {
        onlyOrganizers();
        const ids: unknown = body?.categoriesCertified;
        if (!Array.isArray(ids) || !ids.length || ids.some((x) => !Number.isInteger(x))) {
          throw new BadRequestException('categoriesCertified debe ser una lista de ids de categorias');
        }
        return this.ownership.assertOwnerOfAll(await this.ownership.categories(ids as number[]), user);
      }

      case 'own-referee':
        if (organizer) return;
        if (user.role === Role.arbitro && user.refereeId === id) return;
        throw denied('Solo puede consultar o modificar sus propios datos de arbitro');
      case 'own-referee-or-owner': {
        if (user.role === Role.arbitro && user.refereeId === id) return;
        onlyOrganizers();
        const categories = await this.ownership.refereeCategories(id);
        return this.ownership.assertOwnerOfAll(await this.ownership.categories(categories), user);
      }
      case 'own-assignment': {
        // El organizador confirma solo las asignaciones de los partidos de sus ligas
        if (organizer) return this.assertMatchOwner(await this.ownership.assignmentMatch(id), user);
        if (user.role !== Role.arbitro || !user.refereeId) throw denied('Solo el arbitro asignado puede confirmar');
        const own = await this.assignmentsOf(user.refereeId);
        if (own.some((a) => a.id === id)) return;
        throw denied(`La asignacion ${id} no es suya`);
      }
      case 'assigned-referee': {
        if (organizer) return this.assertMatchOwner(id, user);
        if (user.role !== Role.arbitro || !user.refereeId) {
          throw denied('Solo el arbitro asignado o el organizador de la liga pueden registrar eventos en vivo');
        }
        const own = await this.assignmentsOf(user.refereeId);
        if (own.some((a) => a.matchId === id)) return;
        throw denied(`No tiene asignado el partido ${id}`);
      }
      case 'own-user':
        if (user.sub === id || isPlatformAdmin(user)) return;
        throw denied('Solo puede ver sus propias notificaciones');
      case 'own-user-body':
        if (body?.userId === user.sub) return;
        throw denied('Solo puede modificar sus propias preferencias');
    }
  }
}
