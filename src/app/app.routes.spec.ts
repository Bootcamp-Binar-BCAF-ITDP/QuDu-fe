import { Route } from '@angular/router';

import { routes } from './app.routes';
import { menuGuard } from './core/guard/menu.guard';
import { NAV_ITEMS } from './layout/nav.config';

describe('app routes', () => {
  const flatten = (list: Route[], parents: Route[] = []): { route: Route; chain: Route[] }[] =>
    list.flatMap((route) => [
      { route, chain: [...parents, route] },
      ...(route.children ? flatten(route.children, [...parents, route]) : []),
    ]);

  const all = flatten(routes);

  const guarded = all.filter(({ route }) =>
    (route.canActivate ?? []).includes(menuGuard),
  );

  const menuNames = (function collect(items: typeof NAV_ITEMS): string[] {
    return items.flatMap((item) => [
      ...(item.menu ? [item.menu] : []),
      ...(item.children ? collect(item.children as typeof NAV_ITEMS) : []),
    ]);
  })(NAV_ITEMS);

  const pathOf = (chain: Route[]) => chain.map((r) => r.path).filter(Boolean).join('/');

  it('attaches menuGuard only to routes that name the menu they need', () => {
    const toothless = guarded.filter(({ route }) => !route.data?.['menu']);

    expect(toothless.map(({ chain }) => pathOf(chain))).toEqual([]);
  });

  it('guards every master page, one menu each', () => {
    const master = all.find(({ route }) => route.path === 'master');
    const children = (master?.route.children ?? []).filter((child) => child.path);

    for (const child of children) {
      expect(`${child.path}: ${child.canActivate?.includes(menuGuard)}`).toBe(
        `${child.path}: true`,
      );
      expect(`${child.path}: ${child.data?.['menu']}`).not.toBe(`${child.path}: undefined`);
    }
  });

  it('guards the role-specific work pages too', () => {
    const expected = ['dashboard', 'applications', 'bucket', 'plafond-applications'];

    for (const path of expected) {
      const entry = all.find(({ route }) => route.path === path);

      expect(`${path}: ${entry?.route.canActivate?.includes(menuGuard)}`).toBe(`${path}: true`);
    }
  });

  it('uses menu names the sidebar also knows', () => {
    const unknown = guarded
      .map(({ route, chain }) => ({ menu: route.data?.['menu'] as string, path: pathOf(chain) }))
      .filter(({ menu }) => menu && !menuNames.includes(menu));

    expect(unknown).toEqual([]);
  });
});
