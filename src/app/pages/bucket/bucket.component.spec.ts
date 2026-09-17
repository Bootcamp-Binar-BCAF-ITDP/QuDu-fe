import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.services';
import { BucketService } from '../../core/services/bucket/bucket.services.';
import { LoanStatus } from '../../models/loan-application/loan-application.models';
import { BucketComponent } from './bucket.component';

const pageOf = (over: Record<string, unknown> = {}) => ({
  content: [],
  page: 0,
  size: 5,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
  empty: true,
  ...over,
});

const item = (over: Record<string, unknown> = {}) => ({
  applicationId: 'APP-0001',
  customer: { customerName: 'Budi Santoso' },
  requestedAmount: 10_000_000,
  tenor: 12,
  purpose: 'Renovasi',
  income: 8_000_000,
  status: LoanStatus.PENDING_BACK_OFFICE,
  submissionDate: '2026-09-15T00:00:00Z',
  review: null,
  creditScore: null,
  ...over,
});

describe('BucketComponent', () => {
  let component: BucketComponent;

  let listCalls: Record<string, unknown>[];
  let disburseCalls: Record<string, unknown>[];
  let source$: Subject<any>;
  let failWith: unknown = null;
  let navigated: unknown[][];
  let currentUser: unknown;

  const build = (role = 'MARKETING') => {
    TestBed.resetTestingModule();

    listCalls = [];
    disburseCalls = [];
    source$ = new Subject<any>();
    failWith = null;
    navigated = [];
    currentUser = { role };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BucketService,
          useValue: {
            list: (query: Record<string, unknown>) => {
              listCalls.push(query);
              return failWith ? throwError(() => failWith) : source$.asObservable();
            },
            disbursementBucket: (query: Record<string, unknown>) => {
              disburseCalls.push(query);
              return failWith ? throwError(() => failWith) : source$.asObservable();
            },
          },
        },
        { provide: AuthService, useValue: { user: () => currentUser } },
        { provide: Router, useValue: { navigate: (c: unknown[]) => navigated.push(c) } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new BucketComponent());
  };

  beforeEach(() => build());

  describe('which queue it reads', () => {
    it('reads the reviewer bucket for an ordinary role', () => {
      component.load();

      expect(listCalls).toHaveLength(1);
      expect(disburseCalls).toEqual([]);
    });

    it('shows no tabs unless the user is back office', () => {
      expect(component.showTabs()).toBe(false);
    });

    it('shows tabs for back office, which has two queues', () => {
      build('BACK_OFFICE');
      expect(component.showTabs()).toBe(true);
    });

    it('still reads the verification queue on the first back office tab', () => {
      build('BACK_OFFICE');
      component.load();

      expect(listCalls).toHaveLength(1);
      expect(disburseCalls).toEqual([]);
    });

    it('switches to the disbursement endpoint on the second tab', () => {
      build('BACK_OFFICE');
      component.selectTab('DISBURSEMENT' as never);

      expect(disburseCalls).toHaveLength(1);
      expect(listCalls).toEqual([]);
    });

    it('ignores the tab for a role that has no tabs, so marketing cannot reach it', () => {
      component.activeTab.set('DISBURSEMENT' as never);
      component.load();

      expect(listCalls).toHaveLength(1);
      expect(disburseCalls).toEqual([]);
    });

    it('reports no role when nobody is signed in', () => {
      currentUser = null;
      expect(component.role()).toBeNull();
    });
  });

  describe('loading', () => {
    it('asks for the first page on init, newest first', () => {
      component.ngOnInit();

      expect(listCalls[0]).toMatchObject({ page: 0, sortBy: 'submissionDate', sortDir: 'desc' });
    });

    it('fills the table and the paging figures', () => {
      component.load();
      source$.next(pageOf({ content: [item()], totalElements: 3, totalPages: 1 }));

      expect(component.rows()).toHaveLength(1);
      expect(component.totalElements()).toBe(3);
      expect(component.loading()).toBe(false);
    });

    it('empties the table and explains a failure', () => {
      failWith = { error: { message: 'Queue unavailable.' } };
      component.load();

      expect(component.rows()).toEqual([]);
      expect(component.totalElements()).toBe(0);
      expect(component.error()).toBe('Queue unavailable.');
    });

    it('falls back to wording that suggests a cause', () => {
      failWith = { status: 0 };
      component.load();

      expect(component.error()).toContain('Check your connection');
    });
  });

  describe('the empty message', () => {
    it('is generic for a role with one queue', () => {
      expect(component.emptyMessage()).toContain('Nothing to review');
    });

    it('names the queue for back office, which has two', () => {
      build('BACK_OFFICE');
      expect(component.emptyMessage().trim()).not.toBe('');
    });

    it('changes with the tab', () => {
      build('BACK_OFFICE');
      const verification = component.emptyMessage();

      component.selectTab('DISBURSEMENT' as never);

      expect(component.emptyMessage()).not.toBe(verification);
    });
  });

  describe('tabs, search and paging', () => {
    it('returns to the first page when the tab changes', () => {
      build('BACK_OFFICE');
      component.page.set(3);

      component.selectTab('DISBURSEMENT' as never);

      expect(component.page()).toBe(0);
    });

    it('ignores a click on the tab already showing', () => {
      build('BACK_OFFICE');
      component.selectTab('VERIFICATION' as never);

      expect(listCalls).toEqual([]);
    });

    it('applies a trimmed search from the first page', () => {
      component.page.set(2);
      component.searchInput.set('  budi ');
      component.submitSearch();

      expect(component.appliedSearch()).toBe('budi');
      expect(component.page()).toBe(0);
      expect(listCalls[0]).toMatchObject({ search: 'budi' });
    });

    it('does not reload when the term has not changed', () => {
      component.appliedSearch.set('budi');
      component.searchInput.set('budi');
      component.submitSearch();

      expect(listCalls).toEqual([]);
    });

    it('clears the search and reloads', () => {
      component.searchInput.set('budi');
      component.appliedSearch.set('budi');

      component.clearSearch();

      expect(component.appliedSearch()).toBe('');
      expect(listCalls).toHaveLength(1);
    });

    it('does not reload when there was nothing to clear', () => {
      component.clearSearch();
      expect(listCalls).toEqual([]);
    });

    it('reports a one-based range for the footer', () => {
      component.page.set(1);
      component.size.set(5);
      component.rows.set([item(), item()] as never);
      component.totalElements.set(7);

      expect(component.rangeStart()).toBe(6);
      expect(component.rangeEnd()).toBe(7);
    });

    it('ignores a click on an ellipsis', () => {
      component.totalPages.set(30);
      component.goToPage('…');

      expect(listCalls).toEqual([]);
    });
  });

  describe('opening a row', () => {
    it('navigates to the review page for that application', () => {
      component.open(item() as never);

      expect(navigated).toEqual([['/bucket', 'APP-0001']]);
    });
  });

  describe('the marketing recommendation', () => {
    it('says not reviewed when no review exists yet', () => {
      const result = component.recommendation(item() as never);

      expect(result.label).toBe('Not reviewed');
      expect(result.tone).toBe('neutral');
    });

    it('reads an accept as recommended', () => {
      const result = component.recommendation(
        item({ review: { recommendation: 'ACCEPT' } }) as never,
      );

      expect(result.label).toBe('Recommended');
      expect(result.tone).toBe('positive');
    });

    it('reads a reject as not recommended', () => {
      const result = component.recommendation(
        item({ review: { recommendation: 'REJECT' } }) as never,
      );

      expect(result.label).toBe('Not recommended');
      expect(result.tone).toBe('negative');
    });

    it('matches the verdict whatever case it arrives in', () => {
      expect(
        component.recommendation(item({ review: { recommendation: 'reject' } }) as never).tone,
      ).toBe('negative');
    });

    it('treats an empty recommendation as not reviewed', () => {
      expect(
        component.recommendation(item({ review: { recommendation: '' } }) as never).label,
      ).toBe('Not reviewed');
    });
  });

  describe('the credit score column', () => {
    const score = (over: Record<string, unknown> = {}) => ({
      monthlyInstalment: 2_000_000,
      annualInterestRate: 12,
      monthlyIncome: 8_000_000,
      dsr: 25,
      band: 'LOW',
      unavailableReason: null,
      ...over,
    });

    it('shows the ratio as a rounded percentage', () => {
      expect(component.creditScoreLabel(score({ dsr: 25.4 }) as never)).toBe('25%');
    });

    it('shows a dash when the ratio could not be computed', () => {
      expect(component.creditScoreLabel(score({ dsr: null }) as never)).toBe('—');
      expect(component.creditScoreLabel(null)).toBe('—');
    });

    it('colours each band differently, worsening as the ratio rises', () => {
      const bands = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'];
      const classes = bands.map((band) => component.creditScoreClass(score({ band }) as never));

      expect(new Set(classes).size).toBe(4);
      expect(classes[0]).toContain('green');
      expect(classes[3]).toContain('red');
    });

    it('falls back to a faint style for an unknown or missing band', () => {
      expect(component.creditScoreClass(null)).toContain('slate');
      expect(component.creditScoreClass(score({ band: 'UNKNOWN' }) as never)).toContain('slate');
    });

    it('explains the figure in the tooltip', () => {
      const tooltip = component.creditScoreTooltip(score() as never);

      expect(tooltip).toContain('DSR 25%');
      expect(tooltip).toContain('per month');
      expect(tooltip).toContain('income');
    });

    it('gives the backend reason when the ratio is unavailable', () => {
      const tooltip = component.creditScoreTooltip(
        score({ dsr: null, unavailableReason: 'Income not verified' }) as never,
      );

      expect(tooltip).toBe('Income not verified');
    });

    it('falls back to generic wording when no reason was given', () => {
      expect(component.creditScoreTooltip(score({ dsr: null }) as never)).toContain(
        'unavailable',
      );
      expect(component.creditScoreTooltip(null)).toContain('unavailable');
    });
  });

  describe('display helpers', () => {
    it('formats an amount as rupiah without decimals', () => {
      expect(component.formatRupiah(10_000_000)).toContain('10.000.000');
    });

    it('shows a dash for a missing amount', () => {
      expect(component.formatRupiah(null)).toBe('—');
    });

    it('takes two initials from a name', () => {
      expect(component.initials('Budi Santoso')).toBe('BS');
      expect(component.initials(null)).toBe('?');
    });

    it('gives the same avatar colour for the same name every time', () => {
      expect(component.avatarTint('Budi')).toBe(component.avatarTint('Budi'));
    });

    it('falls back to a neutral chip for an unknown status', () => {
      expect(component.statusStyle('SOMETHING' as LoanStatus).classes).toContain('slate');
    });
  });
});
