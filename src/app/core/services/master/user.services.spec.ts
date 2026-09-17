import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { UserRequest } from '../../../models/master/user.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { UserService } from './user.services';

const URL = `${environment.apiOrigin}/api/users`;
const REGISTER = `${environment.apiOrigin}/api/auth/register`;

const request = {
  username: 'marketing1',
  email: 'marketing1@qudu.test',
  password: 'secret',
  fullName: 'Marketing One',
  accountType: 'USER',
  phoneNumber: '08120000000',
} as UserRequest;

describe('UserService', () => {
  let service: UserService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UserService);
  });

  afterEach(() => backend.verify());

  describe('getAllUsers', () => {
    it('defaults to the first page of five sorted by username ascending', () => {
      service.getAllUsers().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('5');
      expect(req.request.params.get('sortBy')).toBe('username');
      expect(req.request.params.get('sortDir')).toBe('asc');
      req.flush({});
    });

    it('sorts by username rather than by an id, since users have no numeric id', () => {
      service.getAllUsers().subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('sortBy')).not.toContain('Id');
      req.flush({});
    });

    it('passes paging and search through', () => {
      service.getAllUsers({ page: 4, size: 10, search: 'budi' }).subscribe();

      const req = backend.expectOne((r) => r.url === URL);
      expect(req.request.params.get('page')).toBe('4');
      expect(req.request.params.get('search')).toBe('budi');
      req.flush({});
    });
  });

  describe('createUser', () => {
    it('posts to the auth register endpoint, not to the users collection', () => {
      service.createUser(request).subscribe();

      const req = backend.expectOne(REGISTER);
      expect(req.request.method).toBe('POST');
      backend.expectNone(URL);
      req.flush({});
    });

    it('still marks the request as needing a token, unlike a public self-registration', () => {
      service.createUser(request).subscribe();

      const req = backend.expectOne(REGISTER);
      expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
      req.flush({});
    });

    it('sends the whole request body through untouched', () => {
      service.createUser(request).subscribe();

      const req = backend.expectOne(REGISTER);
      expect(req.request.body).toEqual(request);
      req.flush({});
    });
  });

  describe('writes', () => {
    it('updates at /{id} using the string user id', () => {
      service.updateUser('U-001', request).subscribe();

      const req = backend.expectOne(`${URL}/U-001`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('deletes at /{id}', () => {
      service.deleteUser('U-001').subscribe();

      const req = backend.expectOne(`${URL}/U-001`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('sends a token on every call', () => {
      service.getAllUsers().subscribe();
      service.updateUser('U-1', request).subscribe();
      service.deleteUser('U-1').subscribe();

      for (const req of backend.match(() => true)) {
        expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
        req.flush({});
      }
    });
  });
});
