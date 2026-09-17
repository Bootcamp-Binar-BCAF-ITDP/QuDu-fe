import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Subject, throwError } from 'rxjs';

import { AuthService } from '../../core/services/auth.services';
import { DocumentPreviewService } from '../../core/services/document/document-preview.service';
import { PlafondRequestService } from '../../core/services/plafond-request/plafond-request.services';
import { PlafondApplicationReviewComponent } from './plafond-application-review.component';

const request = (over: Record<string, unknown> = {}) => ({
  requestId: 'R-0001',
  customerId: 'C-1',
  customerName: 'Budi Santoso',
  previousLevel: 1,
  requestedLevel: 3,
  requestedAmount: 50_000_000,
  approvedAmount: null,
  status: 'PENDING',
  requestDate: '2026-09-15T00:00:00Z',
  decisionDate: null,
  reviewedBy: null,
  notes: null,
  requestedPlafond: null,
  documents: [],
  ...over,
});

describe('PlafondApplicationReviewComponent', () => {
  let component: PlafondApplicationReviewComponent;

  let params$: BehaviorSubject<{ get: (key: string) => string | null }>;
  let findOne$: Subject<any>;
  let decide$: Subject<any>;
  let decideCalls: unknown[][];
  let findFails: unknown = null;
  let decideFails: unknown = null;
  let wentBack: number;
  let currentUser: unknown;

  const build = (
    role = 'BRANCH_MANAGER',
    requestId: string | null = 'R-0001',
    navigationState: unknown = null,
  ) => {
    TestBed.resetTestingModule();

    params$ = new BehaviorSubject<{ get: (key: string) => string | null }>({
      get: () => requestId,
    });
    findOne$ = new Subject<any>();
    decide$ = new Subject<any>();
    decideCalls = [];
    findFails = null;
    decideFails = null;
    wentBack = 0;
    currentUser = role ? { role } : null;

    history.replaceState({}, '');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlafondRequestService,
          useValue: {
            findOne: () => (findFails ? throwError(() => findFails) : findOne$.asObservable()),
            decide: (...args: unknown[]) => {
              decideCalls.push(args);
              return decideFails ? throwError(() => decideFails) : decide$.asObservable();
            },
          },
        },
        {
          provide: DocumentPreviewService,
          useValue: {
            plafondDocumentUrl: (id: string, docId: number) =>
              `https://api.test/api/bm/plafond-requests/${id}/documents/${docId}/content`,
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: params$.asObservable() } },
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => (navigationState ? { extras: { state: navigationState } } : null),
            navigate: () => undefined,
          },
        },
        { provide: Location, useValue: { back: () => (wentBack += 1) } },
        { provide: AuthService, useValue: { user: () => currentUser } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new PlafondApplicationReviewComponent());
  };

  beforeEach(() => build());

  describe('loading', () => {
    it('takes the request id from the route', () => {
      expect(component.requestId()).toBe('R-0001');
    });

    it('complains when the url carries no id', () => {
      build('BRANCH_MANAGER', null);

      expect(component.error()).toBe('No request id in the URL.');
      expect(component.loading()).toBe(false);
    });

    it('uses a row handed over by the queue instead of fetching again', () => {
      const row = request();
      build('BRANCH_MANAGER', 'R-0001', { request: row });

      expect(component.request()).toBe(row);
      expect(component.loading()).toBe(false);
    });

    it('ignores a handed over row for a different request', () => {
      build('BRANCH_MANAGER', 'R-0001', { request: request({ requestId: 'R-9999' }) });

      expect(component.loading()).toBe(true);
    });

    it('keeps what the lookup found', () => {
      findOne$.next(request());

      expect(component.request()).not.toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('says so when the request is no longer in the queue', () => {
      findOne$.next(null);

      expect(component.request()).toBeNull();
      expect(component.error()).toContain('already have been decided');
    });

    it('explains a lookup failure', () => {
      build();
      findFails = { error: { message: 'Lookup broke.' } };
      component.load();

      expect(component.error()).toBe('Lookup broke.');
    });

    it('goes back through history', () => {
      component.back();
      expect(wentBack).toBe(1);
    });
  });

  describe('who may decide', () => {
    it('lets a branch manager decide a pending request', () => {
      findOne$.next(request());

      expect(component.canDecide()).toBe(true);
      expect(component.mode()).toBe('DECIDE');
    });

    it('refuses any other role', () => {
      build('BACK_OFFICE');
      findOne$.next(request());

      expect(component.canDecide()).toBe(false);
      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toContain('Only a branch manager');
    });

    it('offers no decision on a request already approved', () => {
      findOne$.next(request({ status: 'APPROVED' }));

      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toContain('approved');
    });

    it('offers no decision on a request already rejected', () => {
      findOne$.next(request({ status: 'REJECTED' }));

      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toContain('rejected');
    });

    it('offers no decision once this session has decided it', () => {
      findOne$.next(request());
      component.done.set('Approved.');

      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toBeNull();
    });
  });

  describe('the approved amount', () => {
    beforeEach(() => findOne$.next(request()));

    it('defaults to the requested amount when nothing is typed', () => {
      expect(component.effectiveAmount()).toBe(50_000_000);
    });

    it('uses the typed amount when there is one', () => {
      component.approvedAmount.set(30_000_000);
      expect(component.effectiveAmount()).toBe(30_000_000);
    });

    it('falls back to the requested amount for a zero or negative entry', () => {
      component.approvedAmount.set(0);
      expect(component.effectiveAmount()).toBe(50_000_000);
    });

    it('flags an amount above what was asked for', () => {
      component.approvedAmount.set(60_000_000);

      expect(component.amountTooHigh()).toBe(true);
      expect(component.amountReduced()).toBe(false);
    });

    it('flags a reduced approval', () => {
      component.approvedAmount.set(30_000_000);

      expect(component.amountReduced()).toBe(true);
      expect(component.amountTooHigh()).toBe(false);
    });

    it('flags neither when the amounts match', () => {
      component.approvedAmount.set(50_000_000);

      expect(component.amountTooHigh()).toBe(false);
      expect(component.amountReduced()).toBe(false);
    });
  });

  describe('approving', () => {
    beforeEach(() => findOne$.next(request()));

    it('sends the decision for this request', () => {
      component.approve();

      expect(decideCalls[0][0]).toBe('R-0001');
      expect(decideCalls[0][1]).toMatchObject({ decision: 'APPROVED' });
    });

    it('sends no amount when the reviewer accepted the full request', () => {
      component.approve();

      expect((decideCalls[0][1] as { approvedAmount?: number }).approvedAmount).toBeUndefined();
    });

    it('sends the reduced amount when one was typed', () => {
      component.approvedAmount.set(30_000_000);
      component.approve();

      expect(decideCalls[0][1]).toMatchObject({ approvedAmount: 30_000_000 });
    });

    it('refuses a zero amount before reaching the server', () => {
      component.approvedAmount.set(0);
      component.approve();

      expect(decideCalls).toEqual([]);
      expect(component.actionError()).toContain('greater than zero');
    });

    it('refuses an amount higher than requested', () => {
      component.approvedAmount.set(60_000_000);
      component.approve();

      expect(decideCalls).toEqual([]);
      expect(component.actionError()).toContain('cannot be higher');
    });

    it('sends trimmed notes when any were written', () => {
      component.notes.set('  Looks sound.  ');
      component.approve();

      expect(decideCalls[0][1]).toMatchObject({ notes: 'Looks sound.' });
    });

    it('sends no notes field when the box was left empty', () => {
      component.approve();

      expect((decideCalls[0][1] as { notes?: string }).notes).toBeUndefined();
    });

    it('reports success and clears the form', () => {
      component.notes.set('Fine.');
      component.approve();
      decide$.next(request({ status: 'APPROVED' }));

      expect(component.busy()).toBe(false);
      expect(component.done()).toContain('Approved');
      expect(component.notes()).toBe('');
      expect(component.approvedAmount()).toBeNull();
    });

    it('says the approval was reduced when it was', () => {
      component.approvedAmount.set(30_000_000);
      component.approve();
      decide$.next(request({ status: 'APPROVED' }));

      expect(component.done()).toContain('reduced');
    });

    it('keeps the updated request the server returned', () => {
      component.approve();
      const updated = request({ status: 'APPROVED' });
      decide$.next(updated);

      expect(component.request()).toBe(updated);
    });

    it('refuses a second submission while one is running', () => {
      component.approve();
      component.approve();

      expect(decideCalls).toHaveLength(1);
    });

    it('explains a failure and stays open for a retry', () => {
      decideFails = { error: { message: 'Already decided.' } };
      component.approve();

      expect(component.busy()).toBe(false);
      expect(component.actionError()).toBe('Already decided.');
      expect(component.done()).toBeNull();
    });
  });

  describe('rejecting', () => {
    beforeEach(() => findOne$.next(request()));

    it('insists on a note, so the customer can be told why', () => {
      component.reject();

      expect(decideCalls).toEqual([]);
      expect(component.actionError()).toContain('Add a note');
    });

    it('treats a whitespace-only note as no note', () => {
      component.notes.set('    ');
      component.reject();

      expect(decideCalls).toEqual([]);
    });

    it('sends the rejection once a note is written', () => {
      component.notes.set('Income too low.');
      component.reject();

      expect(decideCalls[0][1]).toMatchObject({
        decision: 'REJECTED',
        notes: 'Income too low.',
      });
    });

    it('sends no amount with a rejection', () => {
      component.notes.set('Income too low.');
      component.reject();

      expect((decideCalls[0][1] as { approvedAmount?: number }).approvedAmount).toBeUndefined();
    });

    it('reports success', () => {
      component.notes.set('Income too low.');
      component.reject();
      decide$.next(request({ status: 'REJECTED' }));

      expect(component.done()).toContain('Rejected');
      expect(component.notes()).toBe('');
    });
  });

  describe('the documents', () => {
    it('has none when the request carries none', () => {
      findOne$.next(request());
      expect(component.documents()).toEqual([]);
    });

    it('lists what the request carries', () => {
      findOne$.next(
        request({ documents: [{ documentId: 1, documentType: 'SLIP', fileName: 'a.pdf' }] }),
      );

      expect(component.documents()).toHaveLength(1);
    });

    it('builds the preview url from the plafond path, not the loan one', () => {
      findOne$.next(request());
      component.openPreview({ documentId: 5 } as never);

      expect(component.previewUrl()).toContain('/api/bm/plafond-requests/R-0001/documents/5/');
    });

    it('closes the preview', () => {
      findOne$.next(request());
      component.openPreview({ documentId: 5 } as never);
      component.closePreview();

      expect(component.previewDocument()).toBeNull();
      expect(component.previewUrl()).toBeNull();
    });
  });

  describe('display helpers', () => {
    it('reports the level jump', () => {
      findOne$.next(request({ previousLevel: 1, requestedLevel: 3 }));
      expect(component.levelJump()).toBe(2);
    });

    it('reports no jump for a customer with no previous level', () => {
      findOne$.next(request({ previousLevel: null }));
      expect(component.levelJump()).toBeNull();
    });

    it('exposes the requested tier when one came with the request', () => {
      findOne$.next(request({ requestedPlafond: { plafondId: 3, level: 3 } }));
      expect(component.tier()).toMatchObject({ level: 3 });
    });

    it('formats an amount as rupiah', () => {
      expect(component.formatRupiah(50_000_000)).toContain('50.000.000');
      expect(component.formatRupiah(null)).toBe('—');
    });

    it('chips the current status', () => {
      findOne$.next(request());
      expect(component.chip().label.trim()).not.toBe('');
    });

    it('builds a stage list describing where the request stands', () => {
      findOne$.next(request());
      expect(component.stages().length).toBeGreaterThan(0);
    });
  });
});
