import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { LayoutSearchService } from './layout-search.service';
import { LayoutComponent } from './layout.component';

interface Snapshot {
  data: Record<string, unknown>;
  firstChild: Snapshot | null;
}

const chain = (...titles: (string | undefined)[]): Snapshot => {
  let node: Snapshot | null = null;

  for (const title of [...titles].reverse()) {
    node = { data: title === undefined ? {} : { title }, firstChild: node };
  }

  return node ?? { data: {}, firstChild: null };
};

describe('LayoutComponent', () => {
  let fixture: ComponentFixture<LayoutComponent>;
  let layout: LayoutComponent;
  let events: Subject<unknown>;
  let search: LayoutSearchService;

  let snapshotRoot: Snapshot;

  const build = () => {
    TestBed.resetTestingModule();

    events = new Subject<unknown>();
    snapshotRoot = chain(undefined);

    TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events,
            get routerState() {
              return { snapshot: { root: snapshotRoot } };
            },
          },
        },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });

    TestBed.overrideComponent(LayoutComponent, { set: { template: '', imports: [] } });

    fixture = TestBed.createComponent(LayoutComponent);
    layout = fixture.componentInstance;
    search = TestBed.inject(LayoutSearchService);
    fixture.detectChanges();
  };

  const navigate = () => events.next(new NavigationEnd(1, '/x', '/x'));

  beforeEach(() => build());

  describe('the page title', () => {
    it('falls back to the product name when no route declares one', () => {
      expect(layout.pageTitle()).toBe('QuickDuit');
    });

    it('reads the title off the route at construction, before any navigation', () => {
      TestBed.resetTestingModule();
      events = new Subject<unknown>();
      snapshotRoot = chain('Applications History');

      TestBed.configureTestingModule({
        imports: [LayoutComponent],
        providers: [
          {
            provide: Router,
            useValue: {
              events,
              get routerState() {
                return { snapshot: { root: snapshotRoot } };
              },
            },
          },
          { provide: ActivatedRoute, useValue: {} },
        ],
      });
      TestBed.overrideComponent(LayoutComponent, { set: { template: '', imports: [] } });

      const created = TestBed.createComponent(LayoutComponent);
      expect(created.componentInstance.pageTitle()).toBe('Applications History');
    });

    it('takes the deepest title, so a child overrides its parent', () => {
      snapshotRoot = chain(undefined, 'Master Data', 'Branch');
      navigate();

      expect(layout.pageTitle()).toBe('Branch');
    });

    it('keeps the parent title when the child declares none', () => {
      snapshotRoot = chain(undefined, 'Master Data', undefined);
      navigate();

      expect(layout.pageTitle()).toBe('Master Data');
    });

    it('updates on every navigation', () => {
      snapshotRoot = chain(undefined, 'Bucket Application');
      navigate();
      expect(layout.pageTitle()).toBe('Bucket Application');

      snapshotRoot = chain(undefined, 'Plafond Applications');
      navigate();
      expect(layout.pageTitle()).toBe('Plafond Applications');
    });
  });

  describe('the sidebar drawer', () => {
    it('starts closed, which is the phone layout', () => {
      expect(layout.sidebarOpen()).toBe(false);
    });

    it('opens and closes on request', () => {
      layout.openSidebar();
      expect(layout.sidebarOpen()).toBe(true);

      layout.closeSidebar();
      expect(layout.sidebarOpen()).toBe(false);
    });

    it('closes itself on navigation, so tapping a link does not leave it covering the page', () => {
      layout.openSidebar();
      navigate();

      expect(layout.sidebarOpen()).toBe(false);
    });
  });

  describe('the shared search box', () => {
    it('resets on navigation, so one page search does not leak into the next', () => {
      search.query.set('budi');
      search.configure('Search applications');

      navigate();

      expect(search.query()).toBe('');
      expect(search.placeholder()).toBe('Search…');
      expect(search.enabled()).toBe(true);
    });

    it('is left alone until a navigation happens', () => {
      search.query.set('budi');
      expect(search.query()).toBe('budi');
    });
  });

  it('ignores router events that are not the end of a navigation', () => {
    layout.openSidebar();
    search.query.set('budi');

    events.next({ id: 2, url: '/y' });

    expect(layout.sidebarOpen()).toBe(true);
    expect(search.query()).toBe('budi');
  });
});
