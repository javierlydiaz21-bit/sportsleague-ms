import { ForbiddenException, Global, Injectable, Module, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { isPlatformAdmin } from '../config/admin';
import { internalHeaders } from '../config/internal';
import { SERVICES, ServiceKey, serviceUrl } from '../config/services';

export interface LeagueOwner {
  leagueId: number;
  ownerId: number | null;
}

/**
 * Propiedad de las ligas para autorizar las escrituras de todos los servicios: averigua a que
 * liga pertenece lo que se quiere modificar (temporada, categoria, equipo, jugador, partido o
 * arbitro) y quien es su propietario, consultando a los servicios con el token interno.
 * Las respuestas se guardan unos segundos: la propiedad casi nunca cambia y asi una pantalla
 * con varias escrituras no repite las mismas consultas.
 */
@Injectable()
export class OwnershipService {
  private readonly cache = new Map<string, { value: unknown; expires: number }>();
  private readonly timeoutMs = 8000;

  private async cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const value = await load();
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }

  private async get<T>(service: ServiceKey, path: string, what: string): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${serviceUrl(service)}/api/v1${path}`, { headers: internalHeaders(), signal: AbortSignal.timeout(this.timeoutMs) });
        if (res.status === 404) throw new NotFoundException(`No existe ${what}`);
        if (res.ok) return (await res.json()) as T;
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
      }
    }
    throw new ServiceUnavailableException(`${SERVICES[service].name} no disponible: no se puede verificar a que liga pertenece ${what}`);
  }

  /** Olvida los propietarios guardados: tras asignar un propietario, el cambio rige de inmediato. */
  forgetOwners(): void {
    for (const key of [...this.cache.keys()]) if (key.startsWith('owner:')) this.cache.delete(key);
  }

  /** Liga y propietario de una liga, temporada o categoria (League Service). */
  league(kind: 'leagues' | 'seasons' | 'categories', id: number): Promise<LeagueOwner> {
    const what = { leagues: `la liga ${id}`, seasons: `la temporada ${id}`, categories: `la categoria ${id}` }[kind];
    return this.cached(`owner:${kind}:${id}`, 30_000, () => this.get<LeagueOwner>('league', `/ownership/${kind}/${id}`, what));
  }

  /** Liga y propietario de varias categorias a la vez (League Service). */
  categories(ids: number[]): Promise<(LeagueOwner & { categoryId: number })[]> {
    const key = [...new Set(ids)].sort((a, b) => a - b).join(',');
    // Clave propia: una lista de una sola categoria no debe chocar con league('categories', id)
    return this.cached(`owner:category-list:${key}`, 30_000, () => this.get('league', `/ownership/categories?ids=${key}`, `alguna de las categorias ${key}`));
  }

  /** Categoria de un equipo (Team Service). */
  async teamCategory(teamId: number): Promise<number> {
    const t = await this.cached(`team:${teamId}`, 300_000, () => this.get<{ categoryId: number }>('team', `/teams/${teamId}`, `el equipo ${teamId}`));
    return t.categoryId;
  }

  /** Categoria del equipo de un jugador (Team Service). */
  async playerCategory(playerId: number): Promise<number> {
    const p = await this.cached(`player:${playerId}`, 300_000, () => this.get<{ categoryId: number }>('team', `/players/${playerId}`, `el jugador ${playerId}`));
    return p.categoryId;
  }

  /** Temporada de un partido (Fixture Service). */
  async matchSeason(matchId: number): Promise<number> {
    const m = await this.cached(`match:${matchId}`, 300_000, () => this.get<{ seasonId: number }>('fixture', `/matches/${matchId}`, `el partido ${matchId}`));
    return m.seasonId;
  }

  /** Partido de una asignacion de arbitro (Referee Service). */
  async assignmentMatch(assignmentId: number): Promise<number> {
    const a = await this.cached(`assignment:${assignmentId}`, 300_000, () =>
      this.get<{ matchId: number }>('referee', `/assignments/${assignmentId}`, `la asignacion ${assignmentId}`),
    );
    return a.matchId;
  }

  /** Categorias en las que esta certificado un arbitro (Referee Service). */
  async refereeCategories(refereeId: number): Promise<number[]> {
    const r = await this.get<{ categoriesCertified: number[] }>('referee', `/referees/${refereeId}`, `el arbitro ${refereeId}`);
    return r.categoriesCertified;
  }

  /**
   * El usuario puede modificar la liga si es su propietario. Una liga sin propietario solo la
   * administra el administrador de la plataforma, hasta que se le asigne un propietario.
   */
  assertOwner(owner: LeagueOwner, user: AuthUser): void {
    if (owner.ownerId === null) {
      if (isPlatformAdmin(user)) return;
      throw new ForbiddenException('Esta liga aun no tiene propietario: solo la administra el administrador de la plataforma');
    }
    if (owner.ownerId !== user.sub) throw new ForbiddenException('Esta liga es de otro organizador');
  }

  /** Igual que assertOwner, para todas las ligas de una lista (por ejemplo, las categorias de un arbitro). */
  assertOwnerOfAll(owners: LeagueOwner[], user: AuthUser): void {
    for (const o of owners) this.assertOwner(o, user);
  }
}

@Global()
@Module({
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
