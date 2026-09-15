import { NavItem } from '../../layout/nav.config';
import { filterNavItems } from './nav-filter.util';

const leaf = (label: string, menu?: string): NavItem => ({
  label,
  icon: [],
  route: `/${label.toLowerCase()}`,
  ...(menu ? { menu } : {}),
});

const parent = (label: string, children: { label: string; menu?: string }[]): NavItem => ({
  label,
  icon: [],
  children: children.map((c) => ({ label: c.label, route: `/${c.label}`, menu: c.menu })),
});

const grants =
  (...menus: string[]) =>
  (menu: string) =>
    menus.includes(menu);

describe('filterNavItems', () => {
  it('keeps an item whose menu the user was granted', () => {
    const items = [leaf('Dashboard', 'Dashboard')];
    expect(filterNavItems(items, grants('Dashboard'))).toEqual(items);
  });

  it('drops an item whose menu the user was not granted', () => {
    expect(filterNavItems([leaf('Dashboard', 'Dashboard')], grants())).toEqual([]);
  });

  it('keeps an item that declares no menu, so a link like Logout is never gated away', () => {
    const items = [leaf('Home')];
    expect(filterNavItems(items, grants())).toEqual(items);
  });

  it('keeps only the granted children of a group', () => {
    const items = [
      parent('Master', [
        { label: 'Role', menu: 'Role' },
        { label: 'Branch', menu: 'Branch' },
      ]),
    ];

    const result = filterNavItems(items, grants('Role'));

    expect(result).toHaveLength(1);
    expect(result[0].children?.map((c) => c.label)).toEqual(['Role']);
  });

  it('drops the whole group when no child survives, leaving no empty expander', () => {
    const items = [parent('Master', [{ label: 'Role', menu: 'Role' }])];
    expect(filterNavItems(items, grants())).toEqual([]);
  });

  it('keeps a child that declares no menu', () => {
    const items = [parent('Master', [{ label: 'About' }])];

    const result = filterNavItems(items, grants());

    expect(result[0].children?.map((c) => c.label)).toEqual(['About']);
  });

  it('ignores a parent menu label and decides on the children, which is where routes live', () => {
    const items: NavItem[] = [
      { ...parent('Master', [{ label: 'Role', menu: 'Role' }]), menu: 'NeverGranted' },
    ];

    expect(filterNavItems(items, grants('Role'))).toHaveLength(1);
  });

  it('does not mutate the array it was given, so the source config stays whole', () => {
    const items = [
      parent('Master', [
        { label: 'Role', menu: 'Role' },
        { label: 'Branch', menu: 'Branch' },
      ]),
    ];
    const before = JSON.stringify(items);

    filterNavItems(items, grants('Role'));

    expect(JSON.stringify(items)).toBe(before);
  });

  it('preserves the declared order rather than the order menus were granted', () => {
    const items = [leaf('A', 'A'), leaf('B', 'B'), leaf('C', 'C')];

    const result = filterNavItems(items, grants('C', 'A'));

    expect(result.map((i) => i.label)).toEqual(['A', 'C']);
  });

  it('returns nothing for an empty config', () => {
    expect(filterNavItems([], grants('Anything'))).toEqual([]);
  });
});
