import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { MenuRequest } from '../../../models/master/menu.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { MenuService } from './menu.services';

const URL = `${environment.apiOrigin}/api/menus`;

const request: MenuRequest = { menuName: 'Dashboard' };

describe('MenuService', () => {
  let service: MenuService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MenuService);
  });

  afterEach(() => backend.verify());

  describe('getAllMenus', () => {
    it('defaults to the first page of five sorted by menuId ascending', () => {
      service.getAllMenus().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sortBy')).toBe('menuId');
      expect(req.request.params.get('sortDir')).toBe('asc');
      req.flush({});
    });

    it('passes paging and search through', () => {
      service.getAllMenus({ page: 2, size: 50, search: 'dash' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('search')).toBe('dash');
      req.flush({});
    });
  });

  describe('getMenuOptions', () => {
    it('reads the whole list from the options subpath', () => {
      service.getMenuOptions().subscribe();

      const req = backend.expectOne((r) => r.url === `${URL}/options`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush({});
    });

    it('feeds the role editor, so it must stay unpaged', () => {
      let received: unknown;
      service.getMenuOptions().subscribe((r) => (received = r.data));

      backend
        .expectOne((r) => r.url === `${URL}/options`)
        .flush({ data: [{ menuId: 1, menuName: 'Dashboard' }] });

      expect(received).toEqual([{ menuId: 1, menuName: 'Dashboard' }]);
    });
  });

  describe('writes', () => {
    it('creates with POST on the collection', () => {
      service.addMenu(request).subscribe();

      const req = backend.expectOne(URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({});
    });

    it('updates at /{id} with no /update segment, unlike branch and role', () => {
      service.updateMenu(9, request).subscribe();

      const req = backend.expectOne(`${URL}/9`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('deletes at /{id} with no /delete segment', () => {
      service.deleteMenu(9).subscribe();

      const req = backend.expectOne(`${URL}/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('sends a token on every call', () => {
      service.getMenuOptions().subscribe();
      service.addMenu(request).subscribe();
      service.updateMenu(1, request).subscribe();
      service.deleteMenu(1).subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({});
      }
    });
  });
});
