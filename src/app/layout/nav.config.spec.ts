import { FOOTER_ITEMS, ICONS, NAV_ITEMS, NavItem } from './nav.config';

interface Navigable {
  label: string;
  route: string;
  menu?: string;
}

const leaves = (items: NavItem[]): Navigable[] =>
  items.flatMap((item) => {
    if (item.children) return item.children;
    return item.route ? [{ label: item.label, route: item.route, menu: item.menu }] : [];
  });

describe('NAV_ITEMS', () => {
  it('gives every top level entry a label and an icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.trim()).not.toBe('');
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it('gives every entry either a route or children, never neither', () => {
    for (const item of NAV_ITEMS) {
      expect(Boolean(item.route) || Boolean(item.children?.length)).toBe(true);
    }
  });

  it('never gives one entry both a route and children, which the sidebar cannot render', () => {
    for (const item of NAV_ITEMS) {
      expect(Boolean(item.route) && Boolean(item.children?.length)).toBe(false);
    }
  });

  it('names a menu on every navigable leaf, or nav-filter would show it to everyone', () => {
    for (const leaf of leaves(NAV_ITEMS)) {
      expect(leaf.menu, `"${leaf.label}" has no menu`).toBeTruthy();
    }
  });

  it('points every route at an absolute path', () => {
    for (const leaf of leaves(NAV_ITEMS)) {
      expect(leaf.route.startsWith('/')).toBe(true);
    }
  });

  it('routes to no duplicate destination', () => {
    const routes = leaves(NAV_ITEMS).map((l) => l.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('carries the exact menu names the backend stores, or the item silently vanishes', () => {
    const menus = leaves(NAV_ITEMS).map((l) => l.menu);

    expect(menus.sort()).toEqual(
      [
        'Applications',
        'Branch',
        'Bucket',
        'Dashboard',
        'Menu',
        'Plafond',
        'Plafond Application',
        'Role',
        'User',
      ].sort(),
    );
  });

  it('names the plafond menu in the singular, though its label and route are plural', () => {
    const item = NAV_ITEMS.find((i) => i.route === '/plafond-applications')!;

    expect(item.label).toBe('Plafond Applications');
    expect(item.menu).toBe('Plafond Application');
  });

  it('groups the five master screens under one expander', () => {
    const master = NAV_ITEMS.find((i) => i.children)!;

    expect(master.children).toHaveLength(5);
    expect(master.children!.map((c) => c.route)).toEqual([
      '/master/roles',
      '/master/branches',
      '/master/menus',
      '/master/users',
      '/master/plafonds',
    ]);
  });

  it('labels each master child with the same word as its menu', () => {
    const master = NAV_ITEMS.find((i) => i.children)!;

    for (const child of master.children!) {
      expect(child.menu).toBe(child.label);
    }
  });
});

describe('FOOTER_ITEMS', () => {
  it('holds the logout action', () => {
    expect(FOOTER_ITEMS.map((i) => i.action)).toContain('logout');
  });

  it('gives logout no route, since it is an action and not a destination', () => {
    const logout = FOOTER_ITEMS.find((i) => i.action === 'logout')!;
    expect(logout.route).toBeUndefined();
  });

  it('gives logout no menu, so it is never filtered away from anyone', () => {
    const logout = FOOTER_ITEMS.find((i) => i.action === 'logout')!;
    expect(logout.menu).toBeUndefined();
  });

  it('still gives it an icon', () => {
    for (const item of FOOTER_ITEMS) {
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('ICONS', () => {
  it('holds only arrays of svg path strings', () => {
    for (const [name, paths] of Object.entries(ICONS)) {
      expect(Array.isArray(paths), `${name} is not an array`).toBe(true);
      for (const d of paths) {
        expect(typeof d).toBe('string');
        expect(d.trim()).not.toBe('');
      }
    }
  });

  it('is copied into each item rather than shared by reference', () => {
    const dashboard = NAV_ITEMS.find((i) => i.route === '/dashboard')!;

    expect(dashboard.icon).toEqual([...ICONS.grid]);
    expect(dashboard.icon).not.toBe(ICONS.grid);
  });
});
