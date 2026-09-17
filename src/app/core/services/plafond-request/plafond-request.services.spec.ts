import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { PlafondDecisionBody } from '../../../models/plafond-request/plafond-request.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { PlafondRequestService } from './plafond-request.services';

const URL = `${environment.apiOrigin}/api/bm/plafond-requests`;

const row = (requestId: string) => ({ requestId, customerName: 'Budi' });

const page = (content: unknown[], pageNumber: number, last: boolean) => ({
  content,
  page: pageNumber,
  size: 100,
  totalElements: 0,
  totalPages: 0,
  first: pageNumber === 0,
  last,
  empty: content.length === 0,
});

describe('PlafondRequestService', () => {
  let service: PlafondRequestService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PlafondRequestService);
  });

  afterEach(() => backend.verify());

  const drain = () => {
    for (const req of backend.match(() => true)) {
      req.flush({ data: page([], 99, true) });
    }
  };

  describe('bucket', () => {
    it('defaults to the first page of ten, oldest request first', () => {
      service.bucket().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.params.get('sort')).toBe('requestDate,asc');
      req.flush({ data: page([], 0, true) });
    });

    it('queues the oldest first, which is the order a reviewer should work', () => {
      service.bucket().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('sort')).toContain(',asc');
      req.flush({ data: page([], 0, true) });
    });

    it('passes the caller paging through', () => {
      service.bucket({ page: 2, size: 50, sortBy: 'customerName', sortDir: 'desc' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('sort')).toBe('customerName,desc');
      req.flush({ data: page([], 2, true) });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.bucket().subscribe((p) => (received = p));

      backend.expectOne((r) => r.url === URL).flush({ data: page([row('R-1')], 0, true) });

      expect(received).toMatchObject({ content: [{ requestId: 'R-1' }] });
    });

    it('sends a token', () => {
      service.bucket().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({ data: page([], 0, true) });
    });
  });

  describe('findOne', () => {
    it('asks for a hundred rows a page, not the ten the bucket view uses', () => {
      service.findOne('R-1').subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('size')).toBe('100');
      req.flush({ data: page([], 0, true) });
    });

    it('returns the row when it is on the only page', () => {
      let received: unknown;
      service.findOne('R-2').subscribe((r) => (received = r));

      backend
        .expectOne((r) => r.url === URL)
        .flush({ data: page([row('R-1'), row('R-2')], 0, true) });

      expect(received).toMatchObject({ requestId: 'R-2' });
    });

    it('walks to the next page when the row is not on the first', () => {
      let received: unknown;
      service.findOne('R-9').subscribe((r) => (received = r));

      backend.expectOne((r) => r.url === URL).flush({ data: page([row('R-1')], 0, false) });

      const second = backend.expectOne((r) => r.url === URL);
      expect(second.request.params.get('page')).toBe('1');
      second.flush({ data: page([row('R-9')], 1, true) });

      expect(received).toMatchObject({ requestId: 'R-9' });
      drain();
    });

    it('increments from the page the server reported, not from a local counter', () => {
      service.findOne('nope').subscribe();

      backend.expectOne((r) => r.url === URL).flush({ data: page([], 4, false) });

      const second = backend.expectOne((r) => r.url === URL);
      expect(second.request.params.get('page')).toBe('5');
      second.flush({ data: page([], 5, true) });
    });

    it('gives null when the row is on no page at all', () => {
      let received: unknown = 'untouched';
      service.findOne('missing').subscribe((r) => (received = r));

      backend.expectOne((r) => r.url === URL).flush({ data: page([row('R-1')], 0, false) });
      backend.expectOne((r) => r.url === URL).flush({ data: page([row('R-2')], 1, true) });

      expect(received).toBeNull();
    });

    it('stops at the last page rather than asking forever', () => {
      service.findOne('missing').subscribe();

      backend.expectOne((r) => r.url === URL).flush({ data: page([], 0, true) });

      backend.expectNone((r) => r.url === URL);
    });

    it('survives a page whose content is null', () => {
      let received: unknown = 'untouched';
      service.findOne('missing').subscribe((r) => (received = r));

      backend
        .expectOne((r) => r.url === URL)
        .flush({ data: { ...page([], 0, true), content: null } });

      expect(received).toBeNull();
    });
  });

  describe('decide', () => {
    const body: PlafondDecisionBody = { decision: 'APPROVED', approvedAmount: 20_000_000 };

    it('puts the decision on the request subpath', () => {
      service.decide('R-1', body).subscribe();

      const req = backend.expectOne(`${URL}/R-1/decision`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ data: row('R-1') });
    });

    it('sets the auth context by hand, since it does not go through putProtected', () => {
      service.decide('R-1', body).subscribe();

      const req = backend.expectOne(`${URL}/R-1/decision`);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({ data: row('R-1') });
    });

    it('unwraps the envelope', () => {
      let received: unknown;
      service.decide('R-1', body).subscribe((r) => (received = r));

      backend.expectOne(`${URL}/R-1/decision`).flush({ data: row('R-1') });

      expect(received).toMatchObject({ requestId: 'R-1' });
    });

    it('carries a rejection without an amount', () => {
      service.decide('R-1', { decision: 'REJECTED', notes: 'Income too low' }).subscribe();

      const req = backend.expectOne(`${URL}/R-1/decision`);
      expect(req.request.body).toEqual({ decision: 'REJECTED', notes: 'Income too low' });
      req.flush({ data: row('R-1') });
    });
  });
});
