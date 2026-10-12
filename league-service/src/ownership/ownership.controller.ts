import { BadRequestException, Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Consulta interna de propiedad para el API Gateway: a que liga pertenece una temporada o una
 * categoria y quien es su propietario. Con esto el gateway autoriza las escrituras de los demas
 * servicios (equipos, calendario, arbitros, eventos) solo al organizador dueño de la liga.
 * No tiene ruta publica en el gateway y, como todo el servicio, exige el token interno.
 */
@ApiTags('ownership')
@Controller('ownership')
export class OwnershipController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('leagues/:id')
  @ApiOperation({ summary: 'Propietario de una liga (uso interno del API Gateway)' })
  @ApiParam({ name: 'id', example: 1 })
  async league(@Param('id', ParseIntPipe) id: number) {
    const l = await this.prisma.league.findUnique({ where: { id }, select: { id: true, ownerId: true } });
    if (!l) throw new NotFoundException(`No se encontro la liga con id ${id}`);
    return { leagueId: l.id, ownerId: l.ownerId };
  }

  @Get('seasons/:id')
  @ApiOperation({ summary: 'Liga y propietario de una temporada (uso interno del API Gateway)' })
  @ApiParam({ name: 'id', example: 1 })
  async season(@Param('id', ParseIntPipe) id: number) {
    const s = await this.prisma.season.findUnique({ where: { id }, select: { league: { select: { id: true, ownerId: true } } } });
    if (!s) throw new NotFoundException(`No se encontro la temporada con id ${id}`);
    return { leagueId: s.league.id, ownerId: s.league.ownerId };
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Liga y propietario de una categoria (uso interno del API Gateway)' })
  @ApiParam({ name: 'id', example: 1 })
  async category(@Param('id', ParseIntPipe) id: number) {
    const c = await this.prisma.category.findUnique({ where: { id }, select: { league: { select: { id: true, ownerId: true } } } });
    if (!c) throw new NotFoundException(`No se encontro la categoria con id ${id}`);
    return { leagueId: c.league.id, ownerId: c.league.ownerId };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Liga y propietario de varias categorias (uso interno del API Gateway)' })
  @ApiQuery({ name: 'ids', example: '1,2' })
  async categories(@Query('ids') ids = '') {
    const list = ids.split(',').filter(Boolean).map(Number);
    if (!list.length || list.some((n) => !Number.isInteger(n))) throw new BadRequestException('Indique ids de categorias, por ejemplo ids=1,2');
    const found = await this.prisma.category.findMany({
      where: { id: { in: list } },
      select: { id: true, league: { select: { id: true, ownerId: true } } },
    });
    const missing = list.filter((id) => !found.some((c) => c.id === id));
    if (missing.length) throw new NotFoundException(`No existen las categorias ${missing.join(', ')}`);
    return found.map((c) => ({ categoryId: c.id, leagueId: c.league.id, ownerId: c.league.ownerId }));
  }
}
