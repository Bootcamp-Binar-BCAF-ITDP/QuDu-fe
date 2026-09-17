import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Subject, defer, throwError } from 'rxjs';

import { DocumentPreviewService } from '../../core/services/document/document-preview.service';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { LoanStatus } from '../../models/loan-application/loan-application.models';
import { BucketReviewComponent } from './bucket-review.component';

const application = (over: Record<string, unknown> = {}) => ({
  applicationId: 'APP-0001',
  customer: { customerName: 'Budi Santoso', nik: '317', phoneNumber: '081' },
  requestedAmount: 10_000_000,
  tenor: 12,
  purpose: 'Renovasi',
  income: 8_000_000,
  status: LoanStatus.CHECKING,
  submissionDate: '2026-09-15T00:00:00Z',
  bank: 'BCA',
  bankAccountNumber: '1234567890',
  bankAccountName: 'Budi Santoso',
  documents: [],
  review: null,
  bmdecision: null,
  verifications: null,
  disbursement: null,
  creditScore: null,
  ...over,
});

describe('BucketReviewComponent', () => {
  let component: BucketReviewComponent;

  let getOne$: Subject<any>;
  let action$: Subject<any>;
  let actionCalls: { op: string; body: unknown }[];
  let getOneFails: unknown = null;
  let actionFails: unknown = null;
  let wentBack: number;

  const build = (applicationId: string | null = 'APP-0001') => {
    TestBed.resetTestingModule();

    getOne$ = new Subject<any>();
    action$ = new Subject<any>();
    actionCalls = [];
    getOneFails = null;
    actionFails = null;
    wentBack = 0;

    const params$ = new BehaviorSubject({ get: () => applicationId });

    const record = (op: string) => (body: unknown) =>
      defer(() => {
        actionCalls.push({ op, body });
        return actionFails ? throwError(() => actionFails) : action$.asObservable();
      });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LoanApplicationService,
          useValue: {
            getOne: () => (getOneFails ? throwError(() => getOneFails) : getOne$.asObservable()),
            submitReview: record('review'),
            decide: record('decide'),
            logCall: record('call'),
            disburse: record('disburse'),
          },
        },
        {
          provide: DocumentPreviewService,
          useValue: {
            loanDocumentUrl: (appId: string, docId: number) =>
              `https://api.test/api/loan-applications/${appId}/documents/${docId}/content`,
            extension: () => 'pdf',
            label: (d: { documentType?: string }) => d?.documentType ?? 'Document',
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: params$.asObservable() } },
        { provide: Location, useValue: { back: () => (wentBack += 1) } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new BucketReviewComponent());
  };

  const loadedAs = (role: string | null, app: Record<string, unknown> = application()) => {
    component.role.set(role as never);
    getOne$.next(app);
  };

  beforeEach(() => build());

  describe('loading', () => {
    it('takes the application id from the route', () => {
      expect(component.applicationId()).toBe('APP-0001');
    });

    it('complains when the url carries no id', () => {
      build(null);

      expect(component.error()).toBe('No application id in the URL.');
      expect(component.loading()).toBe(false);
    });

    it('keeps what the lookup returned', () => {
      getOne$.next(application());

      expect(component.application()).not.toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('says plainly when the application does not exist', () => {
      build();
      getOneFails = { status: 404 };
      component.load();

      expect(component.error()).toBe('Application APP-0001 was not found.');
    });

    it('prefers a server message for any other failure', () => {
      build();
      getOneFails = { status: 500, error: { message: 'Database busy.' } };
      component.load();

      expect(component.error()).toBe('Database busy.');
    });

    it('goes back through history', () => {
      component.back();
      expect(wentBack).toBe(1);
    });
  });

  describe('which action the desk may take', () => {
    const cases: [string, LoanStatus, string][] = [
      ['MARKETING', LoanStatus.CHECKING, 'MARKETING_REVIEW'],
      ['BRANCH_MANAGER', LoanStatus.PENDING_BRANCH_MANAGER, 'BM_DECISION'],
      ['BACK_OFFICE', LoanStatus.PENDING_BACK_OFFICE, 'BACK_OFFICE_CALL'],
      ['BACK_OFFICE', LoanStatus.VERIFIED, 'BACK_OFFICE_DISBURSE'],
    ];

    it('offers each desk its own step', () => {
      for (const [role, status, expected] of cases) {
        build();
        loadedAs(role, application({ status, review: { marketing: { userId: 'U-1' } } }));

        expect(component.mode(), `${role} at ${status}`).toBe(expected);
      }
    });

    it('offers nothing to a role that does not own the current step', () => {
      loadedAs('MARKETING', application({ status: LoanStatus.PENDING_BACK_OFFICE }));

      expect(component.mode()).toBeNull();
    });

    it('offers nothing on a closed application', () => {
      loadedAs('BACK_OFFICE', application({ status: LoanStatus.DISBURSED }));

      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toContain('disbursed');
    });

    it('names who the application is waiting on', () => {
      loadedAs('BACK_OFFICE', application({ status: LoanStatus.CHECKING }));

      expect(component.idleMessage()).toContain('Waiting on marketing');
    });

    it('offers nothing once this session has acted', () => {
      loadedAs('MARKETING');
      component.done.set('Recommended.');

      expect(component.mode()).toBeNull();
      expect(component.idleMessage()).toBeNull();
    });

    it('blocks the branch manager when marketing has not reviewed yet', () => {
      loadedAs('BRANCH_MANAGER', application({ status: LoanStatus.PENDING_BRANCH_MANAGER, review: null }));

      expect(component.missingReview()).toBe(true);
      expect(component.idleMessage()).toContain('has not submitted a review');
    });

    it('lets the branch manager decide once a review exists', () => {
      loadedAs(
        'BRANCH_MANAGER',
        application({
          status: LoanStatus.PENDING_BRANCH_MANAGER,
          review: { marketing: { userId: 'U-1' } },
        }),
      );

      expect(component.missingReview()).toBe(false);
      expect(component.idleMessage()).toBeNull();
    });
  });

  describe('the marketing review', () => {
    beforeEach(() => loadedAs('MARKETING'));

    it('sends an accept once a note is written', () => {
      component.note.set('Documents check out.');
      component.submitReview('ACCEPT');

      expect(actionCalls[0].op).toBe('review');
      expect(actionCalls[0].body).toMatchObject({
        applicationId: 'APP-0001',
        recommendation: 'ACCEPT',
        reviewNote: 'Documents check out.',
      });
    });

    it('insists on a note before accepting too, because the backend requires one', () => {
      component.submitReview('ACCEPT');

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toBe('Review note must be filled before you send it.');
    });

    it('names the field in plain words, never as reviewNote', () => {
      component.submitReview('ACCEPT');

      expect(component.actionError()).not.toContain('reviewNote');
    });

    it('insists on a note before rejecting', () => {
      component.submitReview('REJECT');

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toContain('Add a note');
    });

    it('sends the rejection once a note is written', () => {
      component.note.set('Income does not support it.');
      component.submitReview('REJECT');

      expect(actionCalls[0].body).toMatchObject({
        recommendation: 'REJECT',
        reviewNote: 'Income does not support it.',
      });
    });

    it('trims the note before sending it', () => {
      component.note.set('   Looks fine.   ');
      component.submitReview('ACCEPT');

      expect(actionCalls[0].body).toMatchObject({ reviewNote: 'Looks fine.' });
    });

    it('treats a whitespace-only note as no note', () => {
      component.note.set('    ');
      component.submitReview('ACCEPT');

      expect(actionCalls).toEqual([]);
    });
  });

  describe('the branch manager decision', () => {
    beforeEach(() =>
      loadedAs(
        'BRANCH_MANAGER',
        application({
          status: LoanStatus.PENDING_BRANCH_MANAGER,
          review: { marketing: { userId: 'U-1' } },
        }),
      ),
    );

    it('sends an approval', () => {
      component.submitDecision(true);

      expect(actionCalls[0].op).toBe('decide');
      expect(actionCalls[0].body).toMatchObject({ approve: true });
    });

    it('insists on a note before rejecting', () => {
      component.submitDecision(false);

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toContain('Add a note');
    });

    it('sends the rejection once a note is written', () => {
      component.note.set('Too risky.');
      component.submitDecision(false);

      expect(actionCalls[0].body).toMatchObject({ approve: false, note: 'Too risky.' });
    });
  });

  describe('the verification call', () => {
    beforeEach(() => loadedAs('BACK_OFFICE', application({ status: LoanStatus.PENDING_BACK_OFFICE })));

    it('defaults to a successful contact', () => {
      expect(component.callStatus()).toBe('Can be Contacted');
    });

    it('logs the call with its status and the note', () => {
      component.note.set('Customer confirmed the address.');
      component.logCall();

      expect(actionCalls[0].op).toBe('call');
      expect(actionCalls[0].body).toMatchObject({
        callStatus: 'Can be Contacted',
        verificationNote: 'Customer confirmed the address.',
      });
    });

    it('insists on a note before logging, because the backend requires one', () => {
      component.logCall();

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toBe('Call note must be filled before you log the call.');
    });

    it('names the field in plain words, never as verificationNote', () => {
      component.logCall();

      expect(component.actionError()).not.toContain('verificationNote');
    });

    it('says the application is ready to disburse after a successful call', () => {
      component.note.set('Reached the customer.');
      component.logCall();
      action$.next({});
      getOne$.next(application({ status: LoanStatus.VERIFIED }));

      expect(component.done()).toContain('ready to disburse');
    });

    it('says it stays in the queue after a failed call', () => {
      component.note.set('Number unreachable.');
      component.callStatus.set('Salah Sambung');
      component.logCall();
      action$.next({});
      getOne$.next(application());

      expect(component.done()).toContain('stays in your queue');
    });

    it('offers every declared call status', () => {
      expect(component.callStatuses.length).toBeGreaterThan(1);
    });
  });

  describe('disbursement', () => {
    beforeEach(() => loadedAs('BACK_OFFICE', application({ status: LoanStatus.VERIFIED })));

    it('is ready when a bank and an account number are on file', () => {
      expect(component.disburseReady()).toBe(true);
    });

    it('is not ready without a bank', () => {
      loadedAs('BACK_OFFICE', application({ status: LoanStatus.VERIFIED, bank: '' }));
      expect(component.disburseReady()).toBe(false);
    });

    it('is not ready without an account number', () => {
      loadedAs('BACK_OFFICE', application({ status: LoanStatus.VERIFIED, bankAccountNumber: '  ' }));
      expect(component.disburseReady()).toBe(false);
    });

    it('refuses to disburse without an account, before reaching the server', () => {
      loadedAs('BACK_OFFICE', application({ status: LoanStatus.VERIFIED, bank: '' }));

      component.disburse();

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toContain('no bank account on file');
    });

    it('sends the disbursement when the account is there', () => {
      component.disburse();

      expect(actionCalls[0].op).toBe('disburse');
      expect(actionCalls[0].body).toMatchObject({ approve: true });
    });

    it('insists on a note before rejecting at disbursement', () => {
      component.rejectDisbursement();

      expect(actionCalls).toEqual([]);
      expect(component.actionError()).toContain('Add a note');
    });

    it('sends the rejection once a note is written', () => {
      component.note.set('Account name does not match.');
      component.rejectDisbursement();

      expect(actionCalls[0].body).toMatchObject({
        approve: false,
        note: 'Account name does not match.',
      });
    });

    it('trims the payout account fields it shows', () => {
      loadedAs(
        'BACK_OFFICE',
        application({ status: LoanStatus.VERIFIED, bank: '  BCA  ', bankAccountNumber: ' 123 ' }),
      );

      expect(component.payoutAccount()).toMatchObject({ bank: 'BCA', accountNumber: '123' });
    });
  });

  describe('what happens after an action', () => {
    beforeEach(() => {
      loadedAs('MARKETING');
      component.note.set('Looks fine.');
    });

    it('refetches the application, so the screen shows the new status', () => {
      component.submitReview('ACCEPT');
      action$.next({});
      getOne$.next(application({ status: LoanStatus.PENDING_BRANCH_MANAGER }));

      expect(component.application()).toMatchObject({ status: LoanStatus.PENDING_BRANCH_MANAGER });
      expect(component.busy()).toBe(false);
    });

    it('clears the note', () => {
      component.note.set('Looks fine.');
      component.submitReview('ACCEPT');
      action$.next({});
      getOne$.next(application());

      expect(component.note()).toBe('');
    });

    it('sends nothing on a second submission while one is running', () => {
      component.submitReview('ACCEPT');
      component.submitReview('ACCEPT');

      expect(actionCalls).toHaveLength(1);
    });

    it('is saved from a double send by the call being cold, since busy is checked after it is built', () => {
      component.submitReview('ACCEPT');
      expect(component.busy()).toBe(true);

      component.submitReview('ACCEPT');

      expect(actionCalls).toHaveLength(1);
      expect(component.actionError()).toBeNull();
    });

    it('explains a failure and stays open for a retry', () => {
      actionFails = { error: { message: 'Already reviewed.' } };
      component.submitReview('ACCEPT');

      expect(component.busy()).toBe(false);
      expect(component.actionError()).toBe('Already reviewed.');
      expect(component.done()).toBeNull();
    });

    it('names the cause for a failure the user can act on', () => {
      actionFails = { status: 0 };
      component.submitReview('ACCEPT');

      expect(component.actionError()).toContain('No connection');
    });
  });

  describe('the credit score panel', () => {
    const score = (over: Record<string, unknown> = {}) => ({
      monthlyInstalment: 900_000,
      annualInterestRate: 0.12,
      monthlyIncome: 8_000_000,
      dsr: 11.25,
      band: 'LOW',
      unavailableReason: null,
      ...over,
    });

    it('is empty when the backend sent no score', () => {
      loadedAs('MARKETING');

      expect(component.creditScore()).toBeNull();
      expect(component.debtToIncomePercent()).toBeNull();
      expect(component.estimatedInstallment()).toBeNull();
    });

    it('reads the instalment and the ratio from the backend, not from arithmetic here', () => {
      loadedAs('MARKETING', application({ creditScore: score() }));

      expect(component.estimatedInstallment()).toBe(900_000);
      expect(component.debtToIncomePercent()).toBe(11);
    });

    it('caps the bar at full width for a ratio above one hundred', () => {
      loadedAs('MARKETING', application({ creditScore: score({ dsr: 250 }) }));

      expect(component.dtiBarWidth()).toBe(100);
    });

    it('draws no bar when the ratio is unknown', () => {
      loadedAs('MARKETING');
      expect(component.dtiBarWidth()).toBe(0);
    });

    it('passes on the backend reason when the ratio is unavailable', () => {
      loadedAs(
        'MARKETING',
        application({ creditScore: score({ dsr: null, unavailableReason: 'No income on file' }) }),
      );

      expect(component.dtiUnavailableReason()).toBe('No income on file');
    });

    it('gives each band its own colour', () => {
      const seen = new Set<string>();

      for (const band of ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']) {
        loadedAs('MARKETING', application({ creditScore: score({ band }) }));
        seen.add(component.riskBand().chipClasses);
      }

      expect(seen.size).toBe(4);
    });

    it('labels the worst band with a space rather than the underscore the API sends', () => {
      loadedAs('MARKETING', application({ creditScore: score({ band: 'VERY_HIGH' }) }));

      expect(component.riskBand().label).toBe('VERY HIGH');
    });

    it('labels the other bands as the API spells them', () => {
      for (const band of ['LOW', 'MODERATE', 'HIGH']) {
        loadedAs('MARKETING', application({ creditScore: score({ band }) }));
        expect(component.riskBand().label).toBe(band);
      }
    });

    it('falls back to an unknown band when the backend sent none', () => {
      loadedAs('MARKETING');
      expect(component.riskBand().label).toBe('UNKNOWN');
    });

    it('widens the bar as the band worsens', () => {
      const widths = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'].map((band) => {
        loadedAs('MARKETING', application({ creditScore: score({ band }) }));
        return component.riskBand().width;
      });

      expect(widths).toEqual([...widths].sort((a, b) => a - b));
    });
  });

  describe('the documents', () => {
    it('has none when the application carries none', () => {
      loadedAs('MARKETING');
      expect(component.documents()).toEqual([]);
    });

    it('builds the loan document url for a preview', () => {
      loadedAs('MARKETING');
      component.openDocument({ documentId: 5 } as never);

      expect(component.previewUrl()).toContain(
        '/api/loan-applications/APP-0001/documents/5/content',
      );
    });

    it('closes the preview', () => {
      loadedAs('MARKETING');
      component.openDocument({ documentId: 5 } as never);
      component.closePreview();

      expect(component.previewDocument()).toBeNull();
      expect(component.previewUrl()).toBeNull();
    });
  });

  describe('the history panel', () => {
    it('has no verifications when none were logged', () => {
      loadedAs('MARKETING');
      expect(component.verifications()).toEqual([]);
    });

    it('has no decision until one is made', () => {
      loadedAs('MARKETING');
      expect(component.decision()).toBeNull();
    });

    it('builds a stage list describing where the application stands', () => {
      loadedAs('MARKETING');
      expect(component.stages().length).toBeGreaterThan(0);
    });

    it('chips the current status', () => {
      loadedAs('MARKETING');
      expect(component.chip().label.trim()).not.toBe('');
    });

    it('reads the marketing recommendation when there is one', () => {
      loadedAs('MARKETING', application({ review: { recommendation: 'ACCEPT', marketing: null } }));

      expect(component.recommendation()).not.toBeNull();
    });
  });
});
