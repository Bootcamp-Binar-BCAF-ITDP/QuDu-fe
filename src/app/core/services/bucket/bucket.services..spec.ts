import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { BucketService } from './bucket.services.';

const API = environment.apiOrigin;
const BUCKET = `${API}/api/loan-applications/bucket`;
const APPLICATIONS = `${API}/api/loan-applications`;
const DISBURSE = `${API}/api/loan-disbursements`;

const page = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 5,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
  empty: content.length === 0,
});

describe('BucketService', () => {
  let service: BucketService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BucketService);
  });

  afterEach(() => backend.verify());

  describe('list', () => {
    it('defaults to the first page of five, newest submission first', () => {
      service.list().subscribe();

      const req = backend.expectOne((r) => r.url === BUCKET);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sort')).toBe('submissionDate,desc');
      req.flush({ data: page([]) });
    });

    it('joins sortBy and sortDir into one sort parameter, the Spring Data spelling', () => {
      service.list({ sortBy: 'requestedAmount', sortDir: 'asc' }).subscribe();

      const req = backend.expectOne((r) => r.url === BUCKET);
      expect(req.request.params.get('sort')).toBe('requestedAmount,asc');
      expect(req.request.params.has('sortBy')).toBe(false);
      expect(req.request.params.has('sortDir')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('trims the search term', () => {
      service.list({ search: '  budi  ' }).subscribe();

      const req = backend.expectOne((r) => r.url === BUCKET);
      expect(req.request.params.get('search')).toBe('budi');
      req.flush({ data: page([]) });
    });

    it('omits a search that is only whitespace', () => {
      service.list({ search: '   ' }).subscribe();

      const req = backend.expectOne((r) => r.url === BUCKET);
      expect(req.request.params.has('search')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.list().subscribe((p) => (received = p));

      backend
        .expectOne((r) => r.url === BUCKET)
        .flush({ data: page([{ applicationId: 'APP-1' }]) });

      expect(received).toMatchObject({ content: [{ applicationId: 'APP-1' }] });
    });

    it('sends a token', () => {
      service.list().subscribe();

      const req = backend.expectOne((r) => r.url === BUCKET);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({ data: page([]) });
    });
  });

  describe('disbursementBucket', () => {
    const query = { page: 0, size: 5, sortBy: 'submissionDate', sortDir: 'desc', search: '' };

    it('reads the disbursement queue from its own endpoint', () => {
      service.disbursementBucket(query).subscribe();

      const req = backend.expectOne((r) => r.url === DISBURSE);
      expect(req.request.method).toBe('GET');
      req.flush({ data: page([]) });
    });

    it('builds the same sort parameter as the review bucket', () => {
      service.disbursementBucket({ ...query, sortBy: 'tenor', sortDir: 'asc' }).subscribe();

      const req = backend.expectOne((r) => r.url === DISBURSE);
      expect(req.request.params.get('sort')).toBe('tenor,asc');
      req.flush({ data: page([]) });
    });

    it('trims the search and omits it when blank', () => {
      service.disbursementBucket({ ...query, search: '  x ' }).subscribe();
      let req = backend.expectOne((r) => r.url === DISBURSE);
      expect(req.request.params.get('search')).toBe('x');
      req.flush({ data: page([]) });

      service.disbursementBucket({ ...query, search: '  ' }).subscribe();
      req = backend.expectOne((r) => r.url === DISBURSE);
      expect(req.request.params.has('search')).toBe(false);
      req.flush({ data: page([]) });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.disbursementBucket(query).subscribe((p) => (received = p));

      backend.expectOne((r) => r.url === DISBURSE).flush({ data: page([]) });

      expect(received).toMatchObject({ empty: true });
    });
  });

  describe('creditScore', () => {
    it('reads the score the backend computed, rather than computing one here', () => {
      service.creditScore('APP-0001').subscribe();

      const req = backend.expectOne((r) => r.url === `${APPLICATIONS}/APP-0001/credit-score`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: { dsr: 22.5, band: 'LOW' } });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.creditScore('APP-0001').subscribe((s) => (received = s));

      backend
        .expectOne((r) => r.url === `${APPLICATIONS}/APP-0001/credit-score`)
        .flush({ data: { dsr: 22.5, band: 'LOW' } });

      expect(received).toEqual({ dsr: 22.5, band: 'LOW' });
    });

    it('sends a token', () => {
      service.creditScore('APP-1').subscribe();

      const req = backend.expectOne((r) => r.url === `${APPLICATIONS}/APP-1/credit-score`);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({ data: {} });
    });

    it('does not encode the id, unlike LoanApplicationService.getOne which does', () => {
      service.creditScore('APP/1').subscribe();

      const req = backend.expectOne((r) => r.url === `${APPLICATIONS}/APP/1/credit-score`);
      req.flush({ data: {} });
    });
  });
});
