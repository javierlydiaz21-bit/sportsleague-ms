import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';

/**
 * Administrador de la plataforma: la cuenta de organizador de ADMIN_EMAIL. Administra las ligas
 * que aun no tienen propietario, asigna sus propietarios y crea cuentas de organizador.
 */
export function isPlatformAdmin(user: Pick<AuthUser, 'email' | 'role'> | null | undefined): boolean {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@sportsleague.co').toLowerCase();
  return Boolean(user && user.role === Role.organizador && user.email.toLowerCase() === email);
}
