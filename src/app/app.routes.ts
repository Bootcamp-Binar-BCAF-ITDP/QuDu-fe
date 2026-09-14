import { Routes } from '@angular/router';
import { authGuard } from './core/guard/auth.guard';
import { guestGuard } from './core/guard/guest.guard';
import { menuGuard } from './core/guard/menu.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
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
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./pages/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        canActivate: [authGuard, menuGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'applications',
        data: { title: 'Applications History' },
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./pages/loan-application/loan-application.component').then(
            (m) => m.LoanApplicationComponent,
          ),
      },
      {
        path: 'bucket',
        data: { title: 'Bucket Application' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/bucket/bucket.component').then((m) => m.BucketComponent),
          },
          {
            path: ':applicationId',
            data: { title: 'Application Review' },
            loadComponent: () =>
              import('./pages/bucket/bucket-review.component').then((m) => m.BucketReviewComponent),
          },
        ],
      },
      {
        path: 'plafond-applications',
        data: { title: 'Plafond Applications' },
        canActivate: [menuGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/plafond-application/plafond-application.component').then(
                (m) => m.PlafondApplicationComponent,
              ),
          },
          {
            path: ':requestId',
            data: { title: 'Plafond Request Review' },
            loadComponent: () =>
              import('./pages/plafond-application/plafond-application-review.component').then(
                (m) => m.PlafondApplicationReviewComponent,
              ),
          },
        ],
      },
      {
        path: 'master',
        canActivate: [menuGuard],
        data: { title: 'Master Data' },
        children: [
          {
            path: 'roles',
            data: { title: 'Role' },
            loadComponent: () =>
              import('./pages/master/role/role.component').then((m) => m.RoleComponent),
          },
          {
            path: 'branches',
            data: { title: 'Branch' },
            loadComponent: () =>
              import('./pages/master/branch/branch.component').then((m) => m.BranchComponent),
          },
          {
            path: 'menus',
            data: { title: 'Menu' },
            loadComponent: () =>
              import('./pages/master/menu/menu.component').then((m) => m.MenuComponent),
          },
          {
            path: 'users',
            data: { title: 'User' },
            loadComponent: () =>
              import('./pages/master/user/user.component').then((m) => m.UserComponent),
          },
          {
            path: 'plafonds',
            data: { title: 'Plafond' },
            loadComponent: () =>
              import('./pages/master/plafond/plafond.component').then((m) => m.PlafondComponent),
          },
          { path: '', redirectTo: 'roles', pathMatch: 'full' },
        ],
      },
      { path: '', redirectTo: 'applications', pathMatch: 'full' },
    ],
  },

  {
    path: 'forbidden',
    data: { title: 'Not authorized' },
    loadComponent: () =>
      import('./pages/auth/not-authorized/not-authorized.component').then(
        (m) => m.NotAuthorizedComponent,
      ),
  },

  {
    path: '**',
    data: { title: 'Page Not Found' },
    loadComponent: () =>
      import('./pages/auth/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
