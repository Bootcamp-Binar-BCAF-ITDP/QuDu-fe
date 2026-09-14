import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay } from 'rxjs';

import { REQUIRES_AUTH } from '../context/auth-context';
import { AuthService } from '../services/auth.services';
import { authInterceptor } from './auth.interceptors';

const PROTECTED = 'https://api.test/api/branches';
const REFRESH = 'https://api.test/api/auth/refresh';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  let navigateTo: unknown[][] = [];

  let inFlight: Observable<any> | null = null;

  beforeEach(() => {
    navigateTo = [];
    inFlight = null;

    const authStub: Partial<AuthService> = {
      getToken: () => localStorage.getItem('access_token'),
      getRefreshToken: () => localStorage.getItem('refresh_token'),
      clearSession: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      },
      refresh: () => {
        if (inFlight) return inFlight;
        inFlight = http
          .post<any>(REFRESH, { refreshToken: localStorage.getItem('refresh_token') })
          .pipe(
            finalize(() => (inFlight = null)),
            shareReplay({ bufferSize: 1, refCount: false }),
          );
        return inFlight;
      },
      expireSession: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.navigate(['/login'], {
          replaceUrl: true,
          queryParams: { returnUrl: router.url, reason: 'expired' },
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
        {
          provide: Router,
          useValue: {
            url: '/applications',
            navigate: (commands: unknown[], extras?: unknown) => {
              navigateTo.push([commands, extras]);
              return Promise.resolve(true);
            },
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);

    localStorage.setItem('access_token', 'stale-access');
    localStorage.setItem('refresh_token', 'valid-refresh');
  });

  afterEach(() => {
    localStorage.clear();
  });

  const getProtected = () =>
    http.get(PROTECTED, { context: new HttpContext().set(REQUIRES_AUTH, true) });

  it('leaves an unauthenticated request alone', () => {
    let ok = false;
    http.get('https://api.test/api/plafonds/catalog').subscribe(() => (ok = true));

    const request = backend.expectOne('https://api.test/api/plafonds/catalog');
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({});
    expect(ok).toBe(true);
  });

  it('attaches the bearer token to a protected request', () => {
    getProtected().subscribe();

    const request = backend.expectOne(PROTECTED);
    expect(request.request.headers.get('Authorization')).toBe('Bearer stale-access');
    request.flush({});
  });

  it('refreshes on 401 and replays the original request with the new token', () => {
    let body: unknown = null;
    getProtected().subscribe((response) => (body = response));

    backend.expectOne(PROTECTED).flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne(REFRESH).flush({ token: 'fresh-access', refreshToken: 'next-refresh' });

    const retried = backend.expectOne(PROTECTED);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-access');

    retried.flush({ ok: true });
    expect(body).toEqual({ ok: true });
    expect(navigateTo).toHaveLength(0);
  });

  it('sends the user to login when the refresh itself is refused', () => {
    getProtected().subscribe({ error: () => undefined });

    backend.expectOne(PROTECTED).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigateTo).toHaveLength(1);
    expect(navigateTo[0][0]).toEqual(['/login']);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('carries the page the user was on so they can be returned to it', () => {
    getProtected().subscribe({ error: () => undefined });

    backend.expectOne(PROTECTED).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH).flush(null, { status: 401, statusText: 'Unauthorized' });

    const extras = navigateTo[0][1] as { queryParams: { returnUrl: string; reason: string } };
    expect(extras.queryParams.returnUrl).toBe('/applications');
    expect(extras.queryParams.reason).toBe('expired');
  });

  it('goes straight to login when there is no refresh token to try', () => {
    localStorage.removeItem('refresh_token');

    getProtected().subscribe({ error: () => undefined });
    backend.expectOne(PROTECTED).flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(REFRESH);
    expect(navigateTo).toHaveLength(1);
  });

  it('refreshes once for several requests that expire together', () => {
    getProtected().subscribe({ error: () => undefined });
    getProtected().subscribe({ error: () => undefined });
    getProtected().subscribe({ error: () => undefined });

    const failed = backend.match(PROTECTED);
    expect(failed).toHaveLength(3);
    failed.forEach((r) => r.flush(null, { status: 401, statusText: 'Unauthorized' }));

    const refreshes = backend.match(REFRESH);
    expect(refreshes).toHaveLength(1);

    refreshes[0].flush({ token: 'fresh-access', refreshToken: 'next-refresh' });

    const retried = backend.match(PROTECTED);
    expect(retried).toHaveLength(3);
    retried.forEach((r) => {
      expect(r.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      r.flush({});
    });
  });

  it('does not treat a 403 as an expired session', () => {
    getProtected().subscribe({ error: () => undefined });

    backend.expectOne(PROTECTED).flush(null, { status: 403, statusText: 'Forbidden' });

    backend.expectNone(REFRESH);
    expect(navigateTo).toHaveLength(0);
    expect(localStorage.getItem('access_token')).toBe('stale-access');
  });

  it('does not treat a 500 as an expired session', () => {
    getProtected().subscribe({ error: () => undefined });

    backend.expectOne(PROTECTED).flush(null, { status: 500, statusText: 'Server Error' });

    backend.expectNone(REFRESH);
    expect(navigateTo).toHaveLength(0);
  });

  afterEach(() => {
    backend.verify();
  });
});
