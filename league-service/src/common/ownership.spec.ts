import { ForbiddenException } from '@nestjs/common';
import { actorOf, assertCanEdit } from './ownership';

describe('Propiedad de las ligas', () => {
  const owned = { ownerId: 7 };
  const legacy = { ownerId: null };

  it('el organizador propietario puede modificar su liga', () => {
    expect(() => assertCanEdit(owned, { id: 7, admin: false })).not.toThrow();
  });

  it('otro organizador no puede (403), tampoco el administrador si la liga ya tiene propietario', () => {
    expect(() => assertCanEdit(owned, { id: 8, admin: false })).toThrow(ForbiddenException);
    expect(() => assertCanEdit(owned, { id: 1, admin: true })).toThrow(ForbiddenException);
  });

  it('una liga sin propietario solo la administra el administrador de la plataforma', () => {
    expect(() => assertCanEdit(legacy, { id: 7, admin: false })).toThrow(ForbiddenException);
    expect(() => assertCanEdit(legacy, { id: null, admin: false })).toThrow(ForbiddenException);
    expect(() => assertCanEdit(legacy, { id: 1, admin: true })).not.toThrow();
  });

  it('lee las cabeceras del gateway: solo "true" exacto marca al administrador', () => {
    expect(actorOf('7', 'true')).toEqual({ id: 7, admin: true });
    expect(actorOf('7', 'TRUE')).toEqual({ id: 7, admin: false });
    expect(actorOf(undefined, undefined)).toEqual({ id: null, admin: false });
  });
});
