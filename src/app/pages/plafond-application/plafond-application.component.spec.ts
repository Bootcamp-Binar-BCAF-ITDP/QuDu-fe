import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.services';
import { PlafondRequestService } from '../../core/services/plafond-request/plafond-request.services';
import { PlafondApplicationComponent } from './plafond-application.component';

const pageOf = (over: Record<string, unknown> = {}) => ({
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
  empty: true,
  ...over,
});

const request = (over: Record<string, unknown> = {}) => ({
  requestId: 'R-0001',
  customerId: 'C-1',
  customerName: 'Budi Santoso',
  previousLevel: 1,
  requestedLevel: 3,
  requestedAmount: 50_000_000,
  approvedAmount: null,
  status: 'PENDING',
  requestDate: '2026-09-15T04:31:22.881Z',
  decisionDate: null,
  reviewedBy: null,
  notes: null,
  requestedPlafond: null,
  documents: [],
  ...over,
});

describe('PlafondApplicationComponent', () => {
  let component: PlafondApplicationComponent;

  let calls: Record<string, unknown>[];
  let bucket$: Subject<any>;
  let failWith: unknown = null;
  let navigated: { commands: unknown[]; extras: unknown }[];
  let currentUser: unknown = { role: 'BRANCH_MANAGER' };

  const build = () => {
    TestBed.resetTestingModule();

    calls = [];
    bucket$ = new Subject<any>();
    failWith = null;
    navigated = [];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlafondRequestService,
          useValue: {
            bucket: (query: Record<string, unknown>) => {
              calls.push(query);
              return failWith ? throwError(() => failWith) : bucket$.asObservable();
            },
          },
        },
        { provide: AuthService, useValue: { user: () => currentUser } },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras: unknown) =>
              navigated.push({ commands, extras }),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new PlafondApplicationComponent());
  };

  beforeEach(() => {
    currentUser = { role: 'BRANCH_MANAGER' };
    build();
  });

  describe('loading', () => {
    it('asks for the first page on init, oldest request first', () => {
      component.ngOnInit();

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ page: 0, sortBy: 'requestDate', sortDir: 'asc' });
    });

    it('queues the oldest first, which is the order a reviewer should work', () => {
      component.ngOnInit();
      expect(calls[0]['sortDir']).toBe('asc');
    });

    it('fills the table and the paging figures', () => {
      component.load();
      bucket$.next(pageOf({ content: [request()], totalElements: 7, totalPages: 1, last: true }));

      expect(component.rows()).toHaveLength(1);
      expect(component.totalElements()).toBe(7);
      expect(component.loading()).toBe(false);
    });

    it('empties the table and explains a failure', () => {
      failWith = { error: { message: 'Queue unavailable.' } };
      component.load();

      expect(component.rows()).toEqual([]);
      expect(component.totalElements()).toBe(0);
      expect(component.totalPages()).toBe(0);
      expect(component.error()).toBe('Queue unavailable.');
    });

    it('falls back to wording that suggests a cause', () => {
      failWith = { status: 0 };
      component.load();

      expect(component.error()).toContain('Check your connection');
    });

    it('clears an earlier error when reloading', () => {
      failWith = { status: 500 };
      component.load();
      expect(component.error()).not.toBeNull();

      failWith = null;
      component.load();

      expect(component.error()).toBeNull();
    });
  });

  describe('the signed-in role', () => {
    it('reads the role from the session', () => {
      expect(component.role()).toBe('BRANCH_MANAGER');
    });

    it('reports no role when nobody is signed in', () => {
      currentUser = null;
      build();

      expect(component.role()).toBeNull();
    });
  });

  describe('paging', () => {
    it('reports a one-based range for the footer', () => {
      component.page.set(1);
      component.size.set(10);
      component.rows.set([request(), request()] as never);
      component.totalElements.set(12);

      expect(component.rangeStart()).toBe(11);
      expect(component.rangeEnd()).toBe(12);
    });

    it('reports zero of zero when the queue is empty', () => {
      expect(component.rangeStart()).toBe(0);
      expect(component.rangeEnd()).toBe(0);
    });

    it('lists every page while there are few', () => {
      component.totalPages.set(5);
      expect(component.pageNumbers()).toEqual([1, 2, 3, 4, 5]);
    });

    it('collapses the middle on a long list but keeps the ends', () => {
      component.totalPages.set(30);
      component.page.set(14);

      const pages = component.pageNumbers();
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(30);
      expect(pages).toContain('…');
    });

    it('ignores a click on an ellipsis', () => {
      component.totalPages.set(30);
      component.goToPage('…');

      expect(calls).toEqual([]);
    });

    it('changes the page size and returns to the first page', () => {
      component.page.set(3);
      component.changeSize(25);

      expect(component.size()).toBe(25);
      expect(component.page()).toBe(0);
    });
  });

  describe('sorting', () => {
    it('sorts a new field ascending', () => {
      component.toggleSort('requestedAmount' as never);

      expect(component.sortBy()).toBe('requestedAmount');
      expect(component.sortDir()).toBe('asc');
    });

    it('flips direction on the field already sorted', () => {
      component.toggleSort('requestDate' as never);
      expect(component.sortDir()).toBe('desc');

      component.toggleSort('requestDate' as never);
      expect(component.sortDir()).toBe('asc');
    });
  });

  describe('opening a request', () => {
    it('navigates to the review page for that request', () => {
      const row = request();
      component.open(row as never);

      expect(navigated[0].commands).toEqual(['/plafond-applications', 'R-0001']);
    });

    it('carries the row in navigation state, so the review need not refetch it', () => {
      const row = request();
      component.open(row as never);

      expect(navigated[0].extras).toMatchObject({ state: { request: row } });
    });
  });

  describe('display helpers', () => {
    it('reports how many levels the customer is asking to jump', () => {
      expect(component.levelJump(request({ previousLevel: 1, requestedLevel: 3 }) as never)).toBe(2);
    });

    it('reports no jump for a customer with no previous level', () => {
      expect(component.levelJump(request({ previousLevel: null }) as never)).toBeNull();
    });

    it('reports a negative jump for a downgrade rather than hiding it', () => {
      expect(component.levelJump(request({ previousLevel: 3, requestedLevel: 1 }) as never)).toBe(
        -2,
      );
    });

    it('formats an amount as rupiah without decimals', () => {
      expect(component.formatRupiah(50_000_000)).toContain('50.000.000');
    });

    it('shows a dash for a missing amount, as an unapproved request has', () => {
      expect(component.formatRupiah(null)).toBe('—');
    });

    it('takes two initials from a name', () => {
      expect(component.initials('Budi Santoso')).toBe('BS');
      expect(component.initials(null)).toBe('?');
    });

    it('gives the same avatar colour for the same name every time', () => {
      expect(component.avatarTint('Budi')).toBe(component.avatarTint('Budi'));
    });

    it('styles each request status', () => {
      for (const status of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
        expect(component.statusStyle(status).label.trim()).not.toBe('');
      }
    });

    it('falls back to a neutral chip for a status it does not know', () => {
      expect(component.statusStyle('SOMETHING' as never).classes).toContain('slate');
    });
  });
});
