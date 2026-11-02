import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const panelGuard: CanActivateChildFn = (route) => {
  const auth = inject(AuthService),
    router = inject(Router),
    rol = auth.getRol(),
    path = route.routeConfig?.path || '';
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (rol === 'admin' && path !== 'mi-cuenta') return true;
  if (rol === 'cliente' && path === 'mi-cuenta') return true;
  if (
    rol === 'mecanico' &&
    ['mecanico', 'programa', 'ordenes', 'clientes', 'vehiculos', 'servicios', 'repuestos'].includes(
      path,
    )
  )
    return true;
  return router.parseUrl(auth.destino());
};
