import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { PlafondRequest } from '../../../models/master/plafond.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { PlafondService } from './plafond.services';

const URL = `${environment.apiOrigin}/api/plafonds`;

const request: PlafondRequest = {
  level: 2,
  description: 'Silver',
  minimumAmount: 5_000_000,
  maxAmount: 50_000_000,
  minTenor: 6,
  maxTenor: 36,
  interestRate: 12,
  adminFee: 250_000,
};

describe('PlafondService', () => {
  let service: PlafondService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PlafondService);
  });

  afterEach(() => backend.verify());

  describe('getAllPlafonds', () => {
    it('defaults to the first page of five sorted by plafondId ascending', () => {
      service.getAllPlafonds().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sortBy')).toBe('plafondId');
      expect(req.request.params.get('sortDir')).toBe('asc');
      req.flush({});
    });

    it('reads the guarded collection, not the public catalog', () => {
      service.getAllPlafonds().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.url).not.toContain('/catalog');
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({});
    });

    it('passes paging and search through', () => {
      service.getAllPlafonds({ page: 1, size: 20, sortDir: 'desc', search: 'silver' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('sortDir')).toBe('desc');
      expect(req.request.params.get('search')).toBe('silver');
      req.flush({});
    });
  });

  describe('writes', () => {
    it('creates with POST on the collection', () => {
      service.addPlafond(request).subscribe();

      const req = backend.expectOne(URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({});
    });

    it('sends the money fields as numbers, not formatted strings', () => {
      service.addPlafond(request).subscribe();

      const req = backend.expectOne(URL);
      expect(typeof req.request.body.minimumAmount).toBe('number');
      expect(typeof req.request.body.maxAmount).toBe('number');
      expect(typeof req.request.body.interestRate).toBe('number');
      req.flush({});
    });

    it('updates at /{id}', () => {
      service.updatePlafond(3, request).subscribe();

      const req = backend.expectOne(`${URL}/3`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('deletes at /{id}', () => {
      service.deletePlafond(3).subscribe();

      const req = backend.expectOne(`${URL}/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('sends a token on every write', () => {
      service.addPlafond(request).subscribe();
      service.updatePlafond(1, request).subscribe();
      service.deletePlafond(1).subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({});
      }
    });
  });
});
