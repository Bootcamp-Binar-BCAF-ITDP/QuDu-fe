import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { Branch } from '../../../models/master/branch.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { BranchService } from './branch.services';

const URL = `${environment.apiOrigin}/api/branches`;

const branch = (over: Partial<Branch> = {}): Branch => ({
  branchCode: 'JKT-01',
  branchName: 'Jakarta Pusat',
  email: 'jkt01@qudu.test',
  isActive: true,
  location: 'Jakarta',
  phoneNumber: '02100000',
  ...over,
});

describe('BranchService', () => {
  let service: BranchService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BranchService);
  });

  afterEach(() => backend.verify());

  describe('getAllBranches', () => {
    it('falls back to the first page of five sorted by branchId ascending', () => {
      service.getAllBranches().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sortBy')).toBe('branchId');
      expect(req.request.params.get('sortDir')).toBe('asc');
      req.flush({});
    });

    it('omits an empty search rather than filtering on nothing', () => {
      service.getAllBranches().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.has('search')).toBe(false);
      req.flush({});
    });

    it('sends the caller values when given', () => {
      service
        .getAllBranches({ page: 3, size: 25, sortBy: 'branchName', sortDir: 'desc', search: 'jkt' })
        .subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('3');
      expect(req.request.params.get('size')).toBe('25');
      expect(req.request.params.get('sortBy')).toBe('branchName');
      expect(req.request.params.get('sortDir')).toBe('desc');
      expect(req.request.params.get('search')).toBe('jkt');
      req.flush({});
    });

    it('keeps page zero, which a falsy default would have replaced', () => {
      service.getAllBranches({ page: 0 }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      req.flush({});
    });

    it('sends a token', () => {
      service.getAllBranches().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({});
    });

    it('returns the envelope whole, unlike the loan services which unwrap it', () => {
      let received: unknown;
      service.getAllBranches().subscribe((r) => (received = r));

      backend
        .expectOne((r) => r.url === URL)
        .flush({ status: 200, message: 'ok', data: { content: [] } });

      expect(received).toMatchObject({ message: 'ok', data: { content: [] } });
    });
  });

  describe('writes', () => {
    it('creates with POST on the collection', () => {
      const body = branch();
      service.addBranch(body).subscribe();

      const req = backend.expectOne(URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({});
    });

    it('updates at /update/{id}, which is this service own spelling and not /{id}', () => {
      service.updateBranch(7, branch()).subscribe();

      const req = backend.expectOne(`${URL}/update/7`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('deletes at /delete/{id}', () => {
      service.deleteBranch(7).subscribe();

      const req = backend.expectOne(`${URL}/delete/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('sends a token on every write', () => {
      service.addBranch(branch()).subscribe();
      service.updateBranch(1, branch()).subscribe();
      service.deleteBranch(1).subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({});
      }
    });
  });
});
