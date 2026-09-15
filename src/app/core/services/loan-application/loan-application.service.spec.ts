import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { REQUIRES_AUTH } from '../../../core/context/auth-context';
import {
  BranchManagerDecisionRequest,
  LoanApplicationQuery,
  LoanDisbursementRequest,
  LoanReviewRequest,
  LoanStatus,
  LoanVerificationRequest,
} from '../../../models/loan-application/loan-application.models';
import { LoanApplicationService } from './loan-application.service';

const API = `${environment.apiOrigin}/api`;
const LIST = `${API}/loan-applications`;

const query = (over: Partial<LoanApplicationQuery> = {}): LoanApplicationQuery => ({
  page: 0,
  size: 10,
  sortBy: 'submissionDate',
  sortDir: 'desc',
  ...over,
});

const page = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
  empty: content.length === 0,
});

describe('LoanApplicationService', () => {
  let service: LoanApplicationService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LoanApplicationService);
  });

  afterEach(() => backend.verify());

  const expectGet = (url: string) => backend.expectOne((r) => r.url === url);

  describe('list', () => {
    it('asks for the page, the size and the sort the caller specified', () => {
      service.list(query({ page: 2, size: 25 })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('25');
      expect(req.request.params.get('sort')).toBe('submissionDate,desc');
      req.flush({ data: page([]) });
    });

    it('carries the auth context, since the endpoint is behind a token', () => {
      service.list(query()).subscribe();

      const req = expectGet(LIST);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({ data: page([]) });
    });

    it('unwraps the envelope, so callers get the page and not the wrapper', () => {
      let received: unknown;
      service.list(query()).subscribe((p) => (received = p));

      expectGet(LIST).flush({ data: page([{ applicationId: 'APP-1' }]) });

      expect(received).toMatchObject({ content: [{ applicationId: 'APP-1' }], totalElements: 1 });
    });

    it('repeats the status key once per status, which is what the backend reads as a list', () => {
      service
        .list(query({ statuses: [LoanStatus.CHECKING, LoanStatus.VERIFIED] }))
        .subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.getAll('status')).toEqual(['CHECKING', 'VERIFIED']);
      req.flush({ data: page([]) });
    });

    it('sends no status at all for the All tab, rather than an empty one', () => {
      service.list(query({ statuses: [] })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.has('status')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('sends no status when the caller omits the field', () => {
      service.list(query()).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.has('status')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('trims the search term before sending it', () => {
      service.list(query({ search: '  budi  ' })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.get('search')).toBe('budi');
      req.flush({ data: page([]) });
    });

    it('omits a search that is only whitespace, so the backend does not filter on nothing', () => {
      service.list(query({ search: '   ' })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.has('search')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('sends the date range when one is set', () => {
      service.list(query({ from: '2026-09-01', to: '2026-09-15' })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.get('to')).toBe('2026-09-15');
      req.flush({ data: page([]) });
    });

    it('sends only the half of the range that was filled in', () => {
      service.list(query({ from: '2026-09-01' })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.has('to')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('sends no date parameters when the filter is cleared', () => {
      service.list(query()).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.has('from')).toBe(false);
      expect(req.request.params.has('to')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('keeps page zero, which is the first page and not an absent one', () => {
      service.list(query({ page: 0 })).subscribe();

      const req = expectGet(LIST);
      expect(req.request.params.get('page')).toBe('0');
      req.flush({ data: page([]) });
    });
  });

  describe('the bucket endpoints', () => {
    it('reads the marketing bucket from its own path, not from the list with a filter', () => {
      service.marketingBucket(query()).subscribe();

      const req = expectGet(`${API}/marketing`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: page([]) });
    });

    it('reads the signed-in reviewer bucket from the loan-applications subpath', () => {
      service.myBucket(query()).subscribe();
      expectGet(`${LIST}/bucket`).flush({ data: page([]) });
    });

    it('applies the same paging and date filter to a bucket as to the list', () => {
      service.myBucket(query({ page: 1, from: '2026-09-01', search: ' x ' })).subscribe();

      const req = expectGet(`${LIST}/bucket`);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.get('search')).toBe('x');
      req.flush({ data: page([]) });
    });
  });

  describe('getOne', () => {
    it('reads a single application by id', () => {
      service.getOne('APP-0001').subscribe();
      expectGet(`${LIST}/APP-0001`).flush({ data: { applicationId: 'APP-0001' } });
    });

    it('encodes an id with a slash in it, so it cannot forge a different path', () => {
      service.getOne('APP/0001').subscribe();
      expectGet(`${LIST}/APP%2F0001`).flush({ data: {} });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.getOne('APP-0001').subscribe((a) => (received = a));

      expectGet(`${LIST}/APP-0001`).flush({ data: { applicationId: 'APP-0001' } });

      expect(received).toEqual({ applicationId: 'APP-0001' });
    });
  });

  describe('the decision endpoints', () => {
    const review: LoanReviewRequest = { applicationId: 'APP-1', recommendation: 'ACCEPT' };
    const decision: BranchManagerDecisionRequest = { applicationId: 'APP-1', approve: true };
    const call: LoanVerificationRequest = {
      applicationId: 'APP-1',
      callStatus: 'Can be Contacted',
    };
    const disbursement: LoanDisbursementRequest = { applicationId: 'APP-1', approve: true };

    it('posts a marketing review', () => {
      service.submitReview(review).subscribe();

      const req = backend.expectOne(`${API}/marketing`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(review);
      req.flush({ data: {} });
    });

    it('puts a branch manager decision, matching the verb the backend exposes', () => {
      service.decide(decision).subscribe();

      const req = backend.expectOne(`${API}/bm/decision`);
      expect(req.request.method).toBe('PUT');
      req.flush({ data: {} });
    });

    it('posts a verification call log', () => {
      service.logCall(call).subscribe();

      const req = backend.expectOne(`${API}/loan-verifications`);
      expect(req.request.method).toBe('POST');
      req.flush({ data: {} });
    });

    it('puts a disbursement, which is the verb that caught out an earlier duplicate service', () => {
      service.disburse(disbursement).subscribe();

      const req = backend.expectOne(`${API}/loan-disbursements`);
      expect(req.request.method).toBe('PUT');
      req.flush({ data: {} });
    });

    it('sends a token on every one of them', () => {
      service.submitReview(review).subscribe();
      service.decide(decision).subscribe();
      service.logCall(call).subscribe();
      service.disburse(disbursement).subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({ data: {} });
      }
    });
  });
});
