import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AuthService } from '../../core/services/auth.services';
import { NAV_ITEMS, NavItem } from '../nav.config';
import { SidebarComponent } from './sidebar.component';

const ALL_MENUS = [
  'Dashboard',
  'Applications',
  'Plafond Application',
  'Role',
  'Branch',
  'Menu',
  'User',
  'Plafond',
  'Bucket',
];

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let sidebar: SidebarComponent;
  let events: Subject<unknown>;
  let url: string;
  let loggedOut: number;

  const build = (menus: string[] = ALL_MENUS, startUrl = '/dashboard') => {
    TestBed.resetTestingModule();

    events = new Subject<unknown>();
    url = startUrl;
    loggedOut = 0;

    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events,
            get url() {
              return url;
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            hasMenu: (name: string) =>
              menus.some((m) => m.toLowerCase() === name.toLowerCase()),
            logout: () => (loggedOut += 1),
          },
        },
      ],
    });

    TestBed.overrideComponent(SidebarComponent, { set: { template: '', imports: [] } });

    fixture = TestBed.createComponent(SidebarComponent);
    sidebar = fixture.componentInstance;
    fixture.detectChanges();
  };

  const navigate = (to: string) => {
    url = to;
    events.next(new NavigationEnd(1, to, to));
    fixture.detectChanges();
  };

  const master = () => sidebar.navItems().find((i) => i.children) as NavItem;

  beforeEach(() => build());

  describe('which items are shown', () => {
    it('shows every item to someone granted every menu', () => {
      expect(sidebar.navItems()).toHaveLength(NAV_ITEMS.length);
    });

    it('shows nothing to someone granted no menu at all', () => {
      build([]);
      expect(sidebar.navItems()).toEqual([]);
    });

    it('shows only the granted top level items', () => {
      build(['Dashboard', 'Bucket']);

      expect(sidebar.navItems().map((i) => i.label)).toEqual(['Dashboard', 'Bucket']);
    });

    it('keeps the master group but only its granted children', () => {
      build(['Role', 'Plafond']);

      const group = master();
      expect(group.children!.map((c) => c.label)).toEqual(['Role', 'Plafond']);
    });

    it('drops the master group entirely when no child is granted', () => {
      build(['Dashboard']);

      expect(sidebar.navItems().some((i) => i.children)).toBe(false);
    });

    it('keeps logout for everyone, since it declares no menu', () => {
      build([]);
      expect(sidebar.footerItems().map((i) => i.action)).toContain('logout');
    });
  });

  describe('the expandable group', () => {
    it('opens the group that contains the current route', () => {
      build(ALL_MENUS, '/master/roles');
      expect(sidebar.isOpen(master())).toBe(true);
    });

    it('leaves it closed when the route is elsewhere', () => {
      build(ALL_MENUS, '/dashboard');
      expect(sidebar.isOpen(master())).toBe(false);
    });

    it('opens it when navigation lands inside it', () => {
      expect(sidebar.isOpen(master())).toBe(false);

      navigate('/master/branches');

      expect(sidebar.isOpen(master())).toBe(true);
    });

    it('leaves it open after navigating away, so the user can go back', () => {
      navigate('/master/branches');
      navigate('/dashboard');

      expect(sidebar.isOpen(master())).toBe(true);
    });

    it('can be opened and closed by hand', () => {
      const group = master();

      sidebar.toggleGroup(group);
      expect(sidebar.isOpen(group)).toBe(true);

      sidebar.toggleGroup(group);
      expect(sidebar.isOpen(group)).toBe(false);
    });

    it('knows a group is active from any of its children', () => {
      build(ALL_MENUS, '/master/plafonds');
      expect(sidebar.isGroupActive(master())).toBe(true);
    });

    it('does not call a leaf item a group', () => {
      const dashboard = sidebar.navItems().find((i) => i.route === '/dashboard')!;
      expect(sidebar.isGroupActive(dashboard)).toBe(false);
    });

    it('matches a child route by prefix, so a nested page keeps it open', () => {
      build(ALL_MENUS, '/master/roles/42');
      expect(sidebar.isGroupActive(master())).toBe(true);
    });
  });

  describe('the current url', () => {
    it('starts from the router url', () => {
      build(ALL_MENUS, '/bucket');
      expect(sidebar.url()).toBe('/bucket');
    });

    it('follows navigation', () => {
      navigate('/applications');
      expect(sidebar.url()).toBe('/applications');
    });

    it('ignores events that are not the end of a navigation', () => {
      url = '/applications';
      events.next({ id: 2, url: '/applications' });

      expect(sidebar.url()).toBe('/dashboard');
    });
  });

  describe('the footer action', () => {
    it('signs the user out on logout', () => {
      sidebar.onFooterAction({ label: 'Logout', icon: [], action: 'logout' });
      expect(loggedOut).toBe(1);
    });

    it('does nothing for an item with no action', () => {
      sidebar.onFooterAction({ label: 'Something', icon: [], route: '/x' });
      expect(loggedOut).toBe(0);
    });
  });

  it('starts closed on a phone and takes the open state from the layout', () => {
    expect(sidebar.open()).toBe(false);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(sidebar.open()).toBe(true);
  });

  it('asks the layout to close it rather than closing itself', () => {
    let dismissed = 0;
    sidebar.dismiss.subscribe(() => (dismissed += 1));

    sidebar.dismiss.emit();

    expect(dismissed).toBe(1);
  });
});
