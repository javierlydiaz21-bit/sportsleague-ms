import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateRulesDto } from '../categories/dto/update-rules.dto';
import { CreateLeagueDto } from '../leagues/dto/create-league.dto';
import { CreateCategoryDto } from '../seasons/dto/create-category.dto';

// El mismo ValidationPipe que usa main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const check = (metatype: any, value: any) => pipe.transform(value, { type: 'body', metatype } as ArgumentMetadata);

describe('Validaciones de entrada del League Service', () => {
  it('liga: solo deportes admitidos', async () => {
    await expect(check(CreateLeagueDto, { name: 'Liga UCC', sport: 'tenis' })).rejects.toBeInstanceOf(BadRequestException);
    for (const sport of ['futbol', 'basquet', 'voley']) {
      await expect(check(CreateLeagueDto, { name: 'Liga UCC', sport })).resolves.toMatchObject({ sport });
    }
  });

  it('liga: nombre de 2 a 80 caracteres, sin espacios de sobra', async () => {
    await expect(check(CreateLeagueDto, { name: '   ', sport: 'futbol' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(check(CreateLeagueDto, { name: 'x'.repeat(81), sport: 'futbol' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(check(CreateLeagueDto, { name: '  Liga Barrial  ', sport: 'futbol' })).resolves.toMatchObject({ name: 'Liga Barrial' });
  });

  it('reglamento: solo los criterios de desempate que reconoce el Statistics Service', async () => {
    const base = { pointsWin: 3, pointsDraw: 1 };
    await expect(check(UpdateRulesDto, { ...base, tiebreakerCriteria: 'sorteo' })).rejects.toBeInstanceOf(BadRequestException);
    for (const tiebreakerCriteria of ['diferencia_de_goles', 'goles_a_favor', 'partidos_ganados']) {
      await expect(check(UpdateRulesDto, { ...base, tiebreakerCriteria })).resolves.toMatchObject({ tiebreakerCriteria });
    }
  });

  it('reglamento: victoria entre 1 y 10 puntos', async () => {
    const rule = (pointsWin: number) => check(UpdateRulesDto, { pointsWin, pointsDraw: 0, tiebreakerCriteria: 'goles_a_favor' });
    await expect(rule(0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(rule(11)).rejects.toBeInstanceOf(BadRequestException);
    await expect(rule(2)).resolves.toMatchObject({ pointsWin: 2 });
  });

  it('categoria: nombre obligatorio y rango con formato min-max', async () => {
    await expect(check(CreateCategoryDto, { name: ' ', ageRange: '15-17' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(check(CreateCategoryDto, { name: 'Sub-17', ageRange: '15 a 17' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(check(CreateCategoryDto, { name: ' Sub-17 ', ageRange: '15-17' })).resolves.toMatchObject({ name: 'Sub-17' });
  });

  it('los datos que ya existen en produccion cumplen las reglas nuevas', async () => {
    // Deportes y reglamentos del inventario del 11 de octubre de 2026
    for (const sport of ['futbol', 'basquet', 'voley']) {
      await expect(check(CreateLeagueDto, { name: 'Liga existente', sport })).resolves.toBeDefined();
    }
    for (const [pointsWin, pointsDraw] of [
      [3, 1],
      [2, 1],
    ]) {
      await expect(check(UpdateRulesDto, { pointsWin, pointsDraw, tiebreakerCriteria: 'diferencia_de_goles' })).resolves.toBeDefined();
    }
  });
});
