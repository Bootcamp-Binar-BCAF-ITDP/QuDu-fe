// core/guard/menu.guard.ts
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.services';

export const menuGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredMenu = route.data?.['menu'] as string | undefined;

  if (!requiredMenu) {
    return true;
  }

  if (authService.hasMenu(requiredMenu)) {
    return true;
  }

  return router.createUrlTree(['/forbidden']);
};
