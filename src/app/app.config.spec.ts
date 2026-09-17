import { HttpClient, HttpContext } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { appConfig } from './app.config';
import { routes } from './app.routes';
import { REQUIRES_AUTH } from './core/context/auth-context';

describe('appConfig', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  });

  it('declares the three things the app needs to boot', () => {
    expect(appConfig.providers).toHaveLength(3);
  });

  it('wires the router with the real routing table', () => {
    const router = TestBed.inject(Router);

    expect(router.config).toEqual(routes);
  });

  it('provides an HttpClient', () => {
    expect(TestBed.inject(HttpClient)).toBeTruthy();
  });

  describe('the auth interceptor it installs', () => {
    let http: HttpClient;
    let backend: HttpTestingController;

    beforeEach(() => {
      localStorage.clear();
      http = TestBed.inject(HttpClient);
      backend = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      backend.verify();
      localStorage.clear();
    });

    it('attaches the stored token to a request that asked for one', () => {
      localStorage.setItem('access_token', 'access-1');

      http
        .get('https://api.test/api/branches', {
          context: new HttpContext().set(REQUIRES_AUTH, true),
        })
        .subscribe();

      const req = backend.expectOne('https://api.test/api/branches');
      expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
      req.flush({});
    });

    it('leaves an unmarked request alone, which is what keeps login anonymous', () => {
      localStorage.setItem('access_token', 'access-1');

      http.get('https://api.test/api/auth/login').subscribe();

      const req = backend.expectOne('https://api.test/api/auth/login');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('omits the header entirely when there is no token, rather than sending Bearer null', () => {
      http
        .get('https://api.test/api/branches', {
          context: new HttpContext().set(REQUIRES_AUTH, true),
        })
        .subscribe();

      const req = backend.expectOne('https://api.test/api/branches');
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });
  });
});
