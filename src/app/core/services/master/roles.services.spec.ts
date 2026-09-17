import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { RoleRequest } from '../../../models/master/role.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { RolesService } from './roles.services';

const URL = `${environment.apiOrigin}/api/roles`;

const request: RoleRequest = {
  roleName: 'MARKETING',
  description: 'Front line',
  menuIds: [1, 2],
};

describe('RolesService', () => {
  let service: RolesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(RolesService);
  });

  afterEach(() => backend.verify());

  describe('getAllRoles', () => {
    it('defaults to the first page of five sorted by roleId ascending', () => {
      service.getAllRoles().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sortBy')).toBe('roleId');
      expect(req.request.params.get('sortDir')).toBe('asc');
      req.flush({});
    });

    it('passes a search term through', () => {
      service.getAllRoles({ search: 'marketing' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('search')).toBe('marketing');
      req.flush({});
    });

    it('omits an empty search', () => {
      service.getAllRoles({ search: '' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.has('search')).toBe(false);
      req.flush({});
    });
  });

  describe('getRoleOptions', () => {
    it('reads the unpaged options list from its own subpath', () => {
      service.getRoleOptions().subscribe();

      const req = backend.expectOne((r) => r.url === `${URL}/options`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('sends no paging parameters, because options is the whole list', () => {
      service.getRoleOptions().subscribe();

      const req = backend.expectOne((r) => r.url === `${URL}/options`);
      expect(req.request.params.keys()).toEqual([]);
      req.flush({});
    });
  });

  describe('writes', () => {
    it('creates with POST on the collection', () => {
      service.addRoles(request).subscribe();

      const req = backend.expectOne(URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({});
    });

    it('sends menuIds as the numeric list the backend expects', () => {
      service.addRoles(request).subscribe();

      const req = backend.expectOne(URL);
      expect(req.request.body.menuIds).toEqual([1, 2]);
      req.flush({});
    });

    it('updates at /update/{id}', () => {
      service.updateRole(4, request).subscribe();

      const req = backend.expectOne(`${URL}/update/4`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('deletes at /delete/{id}', () => {
      service.deleteRole(4).subscribe();

      const req = backend.expectOne(`${URL}/delete/4`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('sends a token on every call', () => {
      service.getRoleOptions().subscribe();
      service.addRoles(request).subscribe();
      service.updateRole(1, request).subscribe();
      service.deleteRole(1).subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({});
      }
    });
  });
});
