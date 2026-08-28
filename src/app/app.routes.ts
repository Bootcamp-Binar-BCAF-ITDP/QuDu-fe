import { Routes } from '@angular/router';
import { authGuard } from './core/guard/auth.guard';

export const routes: Routes = [
  /* Public Routes */
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
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./pages/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },

  /* Protected Routes */
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'applications',
        data: { title: 'Applications History' },
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
        path: 'master',
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
          { path: '', redirectTo: 'roles', pathMatch: 'full' },
        ],
      },
      { path: '', redirectTo: 'applications', pathMatch: 'full' },
    ],
  },

  // Not Authorized
  {
    path: 'forbidden',
    data: { title: 'Not authorized' },
    loadComponent: () =>
      import('./pages/auth/not-authorized/not-authorized.component').then(
        (m) => m.NotAuthorizedComponent,
      ),
  },

  // Not Found
  {
    path: '**',
    data: { title: 'Page Not Found' },
    loadComponent: () =>
      import('./pages/auth/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
