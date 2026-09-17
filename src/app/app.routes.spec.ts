import { Route } from '@angular/router';

import { routes } from './app.routes';
import { authGuard } from './core/guard/auth.guard';
import { guestGuard } from './core/guard/guest.guard';
import { menuGuard } from './core/guard/menu.guard';

const flatten = (list: Route[], prefix = ''): { path: string; route: Route }[] =>
  list.flatMap((route) => {
    const here = [prefix, route.path ?? ''].filter(Boolean).join('/');
    const self = [{ path: here || '', route }];
    return route.children ? [...self, ...flatten(route.children, here)] : self;
  });

const all = flatten(routes);

const byPath = (path: string) => all.find((entry) => entry.path === path)?.route;

const shell = routes.find((r) => r.path === '' && !!r.children)!;

describe('the routing table', () => {
  it('lazy loads every page, so the login screen does not ship the whole app', () => {
    const leaves = all.filter(({ route }) => !route.children && !route.redirectTo);

    expect(leaves.length).toBeGreaterThan(0);
    for (const { path, route } of leaves) {
      expect(typeof route.loadComponent, `route "${path}" has no loadComponent`).toBe('function');
    }
  });

  it('declares no eager component anywhere', () => {
    for (const { route } of all) {
      expect(route.component).toBeUndefined();
    }
  });

  it('puts the wildcard last, or it would swallow every route after it', () => {
    expect(routes[routes.length - 1].path).toBe('**');
    expect(routes.filter((r) => r.path === '**')).toHaveLength(1);
  });

  it('keeps the forbidden page reachable, ahead of the wildcard', () => {
    const forbidden = routes.findIndex((r) => r.path === 'forbidden');
    const wildcard = routes.findIndex((r) => r.path === '**');

    expect(forbidden).toBeGreaterThanOrEqual(0);
    expect(forbidden).toBeLessThan(wildcard);
  });
});

describe('the authenticated shell', () => {
  it('guards the whole shell, so no child is reachable signed out', () => {
    expect(shell.canActivate).toContain(authGuard);
  });

  it('lazy loads the layout itself', () => {
    expect(typeof shell.loadComponent).toBe('function');
  });

  it('sends the bare root to applications', () => {
    const index = shell.children!.find((c) => c.path === '');

    expect(index?.redirectTo).toBe('applications');
    expect(index?.pathMatch).toBe('full');
  });

  it('sends bare master to roles', () => {
    const master = shell.children!.find((c) => c.path === 'master')!;
    const index = master.children!.find((c) => c.path === '');

    expect(index?.redirectTo).toBe('roles');
    expect(index?.pathMatch).toBe('full');
  });

  it('marks every redirect pathMatch full, or a prefix match would loop', () => {
    for (const { route } of all) {
      if (route.redirectTo) {
        expect(route.pathMatch).toBe('full');
      }
    }
  });

  it('carries a title for the pages the header reads one from', () => {
    expect(byPath('applications')?.data?.['title']).toBe('Applications History');
    expect(byPath('bucket')?.data?.['title']).toBe('Bucket Application');
    expect(byPath('master')?.data?.['title']).toBe('Master Data');
  });
});

describe('the signed-out pages', () => {
  it('keeps a signed-in user off the login page', () => {
    expect(byPath('login')?.canActivate).toContain(guestGuard);
  });

  it('does not guard register, forgot-password or reset-password the same way', () => {
    for (const path of ['register', 'forgot-password', 'reset-password/:token']) {
      expect(byPath(path)?.canActivate ?? []).not.toContain(guestGuard);
    }
  });

  it('takes the reset token from the path, matching the link the backend emails', () => {
    expect(byPath('reset-password/:token')).toBeDefined();
    expect(routes.some((r) => r.path === 'reset-password')).toBe(false);
  });
});

describe('menu gating', () => {
  const guarded = all.filter(({ route }) => (route.canActivate ?? []).includes(menuGuard));

  it('is declared on the pages that belong to a menu', () => {
    expect(guarded.map((g) => g.path).sort()).toEqual(
      ['applications', 'dashboard', 'master', 'plafond-applications'].sort(),
    );
  });

  it('is inert, because not one of those routes sets data.menu for the guard to read', () => {
    for (const { path, route } of guarded) {
      expect(route.data?.['menu'], `route "${path}" now sets data.menu`).toBeUndefined();
    }
  });

  it('leaves bucket without the guard at all, unlike its siblings', () => {
    expect(byPath('bucket')?.canActivate ?? []).not.toContain(menuGuard);
  });
});

describe('the nested review routes', () => {
  it('reviews a loan application by id under bucket', () => {
    expect(byPath('bucket/:applicationId')).toBeDefined();
    expect(byPath('bucket/:applicationId')?.data?.['title']).toBe('Application Review');
  });

  it('reviews a plafond request by id under plafond-applications', () => {
    expect(byPath('plafond-applications/:requestId')).toBeDefined();
    expect(byPath('plafond-applications/:requestId')?.data?.['title']).toBe(
      'Plafond Request Review',
    );
  });

  it('gives each parent an index child, so the list still renders at the bare path', () => {
    for (const parent of ['bucket', 'plafond-applications']) {
      const route = byPath(parent)!;
      expect(route.children?.some((c) => c.path === '')).toBe(true);
    }
  });
});

describe('the master pages', () => {
  const master = byPath('master')!;

  it('lists all five master screens', () => {
    const paths = master.children!.map((c) => c.path).filter(Boolean);
    expect(paths.sort()).toEqual(['branches', 'menus', 'plafonds', 'roles', 'users']);
  });

  it('titles each one for the header', () => {
    const titles = master
      .children!.filter((c) => c.path)
      .map((c) => c.data?.['title']);

    expect(titles).toEqual(['Role', 'Branch', 'Menu', 'User', 'Plafond']);
  });
});
