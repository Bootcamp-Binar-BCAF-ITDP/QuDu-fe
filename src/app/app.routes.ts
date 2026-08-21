import { Routes } from '@angular/router';
import { authGuard } from './core/guard/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'master',
    loadComponent: () =>
      import('./pages/master/master-layout/master-layout.component').then(
        (m) => m.MasterLayoutComponent,
      ),
    children: [
      {
        path: 'roles',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/master/role/role.component').then((m) => m.RoleComponent),
      },
      {
        path: 'branches',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/master/branch/branch.component').then((m) => m.BranchComponent),
      },
      {
        path: 'menus',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/master/menu/menu.component').then((m) => m.MenuComponent),
      },
    ],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
