import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentPreviewService } from '../../core/services/document/document-preview.service';
import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { LoanStatus } from '../../models/loan-application/loan-application.models';
import { ApplicationDetailModalComponent } from './application-review-modal.component';

const doc = (documentId: number, documentType: string, fileName = 'x.png') => ({
  documentId,
  documentType,
  fileName,
  fileUrl: `/files/${documentId}`,
});

const application = (over: Record<string, unknown> = {}) => ({
  applicationId: 'APP-0001',
  customer: { customerName: 'Budi Santoso', nik: '317', phoneNumber: '081' },
  requestedAmount: 10_000_000,
  tenor: 12,
  purpose: 'Renovasi',
  income: 8_000_000,
  status: LoanStatus.CHECKING,
  submissionDate: '2026-09-15T00:00:00Z',
  documents: null,
  review: null,
  bmdecision: null,
  verifications: null,
  disbursement: null,
  creditScore: null,
  ...over,
});

describe('ApplicationDetailModalComponent', () => {
  let fixture: ComponentFixture<ApplicationDetailModalComponent>;
  let modal: ApplicationDetailModalComponent;

  const build = (app: Record<string, unknown> = application()) => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [ApplicationDetailModalComponent],
      providers: [
        { provide: LoanApplicationService, useValue: {} },
        {
          provide: DocumentPreviewService,
          useValue: {
            loanDocumentUrl: (appId: string, docId: number) =>
              `https://api.test/api/loan-applications/${appId}/documents/${docId}/content`,
          },
        },
      ],
    });

    TestBed.overrideComponent(ApplicationDetailModalComponent, {
      set: { template: '', imports: [] },
    });

    fixture = TestBed.createComponent(ApplicationDetailModalComponent);
    fixture.componentRef.setInput('application', app);
    modal = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => build());

  afterEach(() => {
    document.body.classList.remove('overflow-hidden');
  });

  describe('the page behind it', () => {
    it('is frozen while the modal is open', () => {
      expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    });

    it('is released when the modal goes away', () => {
      fixture.destroy();
      expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    });
  });

  describe('closing', () => {
    it('tells the page rather than closing itself', () => {
      let closed = 0;
      modal.closed.subscribe(() => (closed += 1));

      modal.close();

      expect(closed).toBe(1);
    });

    it('closes on a click on the backdrop itself', () => {
      let closed = 0;
      modal.closed.subscribe(() => (closed += 1));

      const backdrop = {} as EventTarget;
      modal.onBackdropClick({ target: backdrop, currentTarget: backdrop } as MouseEvent);

      expect(closed).toBe(1);
    });

    it('stays open on a click inside the panel', () => {
      let closed = 0;
      modal.closed.subscribe(() => (closed += 1));

      modal.onBackdropClick({ target: {}, currentTarget: {} } as MouseEvent);

      expect(closed).toBe(0);
    });
  });

  describe('the document tabs', () => {
    it('has none when the application carries no documents', () => {
      expect(modal.documents()).toEqual([]);
      expect(modal.activeDocument()).toBeNull();
    });

    it('treats a null document list as empty', () => {
      build(application({ documents: null }));
      expect(modal.documents()).toEqual([]);
    });

    it('starts on the first document', () => {
      build(application({ documents: [doc(1, 'KTP'), doc(2, 'SALARY_SLIP')] }));

      expect(modal.activeDocumentKey()).toBe(1);
    });

    it('follows the chosen document', () => {
      build(application({ documents: [doc(1, 'KTP'), doc(2, 'SALARY_SLIP')] }));

      modal.activeDocumentId.set(2);

      expect(modal.activeDocumentKey()).toBe(2);
    });

    it('falls back to the first when the chosen id is not in the list', () => {
      build(application({ documents: [doc(1, 'KTP')] }));

      modal.activeDocumentId.set(99);

      expect(modal.activeDocumentKey()).toBe(1);
    });

    it('labels a tab from the document type', () => {
      expect(modal.documentTabLabel(doc(1, 'SALARY_SLIP') as never)).toBe('Salary Slip');
    });

    it('keeps known acronyms upper case', () => {
      expect(modal.documentTabLabel(doc(1, 'KTP') as never)).toBe('KTP');
    });

    it('falls back to a generic label for a document with no type', () => {
      expect(modal.documentTabLabel({ documentId: 1 } as never)).toBe('Document');
    });
  });

  describe('the document preview', () => {
    it('shows none until one is opened', () => {
      expect(modal.previewDocument()).toBeNull();
      expect(modal.previewUrl()).toBeNull();
    });

    it('builds the content url for the opened document', () => {
      modal.openPreview(doc(7, 'KTP') as never);

      expect(modal.previewUrl()).toBe(
        'https://api.test/api/loan-applications/APP-0001/documents/7/content',
      );
    });

    it('gives no url for a document with no id', () => {
      modal.openPreview({ documentType: 'KTP' } as never);

      expect(modal.previewUrl()).toBeNull();
    });

    it('closes again', () => {
      modal.openPreview(doc(7, 'KTP') as never);
      modal.closePreview();

      expect(modal.previewDocument()).toBeNull();
      expect(modal.previewUrl()).toBeNull();
    });
  });

  describe('the instalment estimate', () => {
    it('comes from the backend credit score, not from arithmetic here', () => {
      build(application({ creditScore: { monthlyInstalment: 950_000, annualInterestRate: 0.12 } }));

      expect(modal.estimatedInstallment()).toBe(950_000);
    });

    it('is absent when the backend could not compute one', () => {
      expect(modal.estimatedInstallment()).toBeNull();
    });

    it('labels the rate as a yearly percentage', () => {
      build(application({ creditScore: { annualInterestRate: 0.12 } }));

      expect(modal.installmentRateLabel()).toBe('12% p.a.');
    });

    it('keeps a meaningful decimal on the rate', () => {
      build(application({ creditScore: { annualInterestRate: 0.1275 } }));

      expect(modal.installmentRateLabel()).toBe('12.75% p.a.');
    });

    it('says so when there is no rate rather than showing zero per cent', () => {
      expect(modal.installmentRateLabel()).toBe('rate unavailable');
    });
  });

  describe('the timeline', () => {
    it('always starts with the submission', () => {
      expect(modal.timeline()[0].key).toBe('submitted');
    });

    it('grows as each desk acts on the application', () => {
      const bare = modal.timeline().length;

      build(
        application({
          review: { reviewId: 1, marketing: null, recommendation: 'ACCEPT' },
          bmdecision: { decisionId: 1, branchManager: null, decision: 'APPROVED' },
        }),
      );

      expect(modal.timeline().length).toBeGreaterThan(bare);
    });

    it('gives every entry a title and a tone', () => {
      build(
        application({
          review: { reviewId: 1, marketing: null, recommendation: 'REJECT' },
        }),
      );

      for (const entry of modal.timeline()) {
        expect(entry.title.trim()).not.toBe('');
        expect(['positive', 'negative', 'neutral']).toContain(entry.tone);
      }
    });

    it('colours the dot by tone', () => {
      expect(modal.toneDotClass('positive')).toContain('green');
      expect(modal.toneDotClass('negative')).toContain('red');
      expect(modal.toneDotClass('neutral')).toContain('slate');
    });
  });

  describe('display helpers', () => {
    it('formats an amount as rupiah without decimals', () => {
      expect(modal.formatRupiah(10_000_000)).toContain('10.000.000');
    });

    it('shows a dash for a missing amount', () => {
      expect(modal.formatRupiah(null)).toBe('—');
    });

    it('writes a tenor under a year in months', () => {
      expect(modal.formatMonths(6)).toBe('6 months');
    });

    it('writes a whole number of years without a months tail', () => {
      expect(modal.formatMonths(24)).toBe('2 years');
    });

    it('uses the singular for one year', () => {
      expect(modal.formatMonths(12)).toBe('1 year');
    });

    it('writes years and months together', () => {
      expect(modal.formatMonths(18)).toBe('1 year 6 months');
    });

    it('shows a dash for a missing tenor', () => {
      expect(modal.formatMonths(null)).toBe('—');
    });

    it('takes two initials from a name', () => {
      expect(modal.initials('Budi Santoso')).toBe('BS');
      expect(modal.initials(null)).toBe('?');
    });
  });
});
