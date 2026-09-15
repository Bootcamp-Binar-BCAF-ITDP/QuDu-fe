import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../../models/auth.models';
import { AuthService } from './auth.services';

const credentials: LoginRequest = {
  usernameOrEmail: 'marketing1',
  password: 'secret',
  accountType: 'USER',
};

const AUTH = `${environment.apiOrigin}/api/auth`;
const LOGIN = `${AUTH}/login`;
const REFRESH = `${AUTH}/refresh`;
const LOGOUT = `${AUTH}/logout`;

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const EXPIRY_KEY = 'access_expires_at';
const USER_KEY = 'current_user';

const loginResponse = (over: Partial<LoginResponse> = {}): LoginResponse => ({
  token: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 900,
  userId: 'U1',
  username: 'marketing1',
  role: 'MARKETING',
  email: 'marketing1@qudu.test',
  fullName: 'Marketing One',
  menus: [{ menuId: 1, menuName: 'Dashboard' }],
  ...over,
});

describe('AuthService', () => {
  let service: AuthService;
  let backend: HttpTestingController;
  let navigated: { commands: unknown[]; extras?: unknown }[];
  let routerStub: { url: string; navigate: (c: unknown[], e?: unknown) => void };

  const build = () => {
    TestBed.resetTestingModule();

    navigated = [];
    routerStub = {
      url: '/dashboard',
      navigate: (commands: unknown[], extras?: unknown) => {
        navigated.push({ commands, extras });
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
  };

  beforeEach(() => {
    localStorage.clear();
    build();
  });

  afterEach(() => {
    service.clearSession();
    backend.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('stores the access token, the refresh token and the whole user record', () => {
      service.login(credentials).subscribe();
      backend.expectOne(LOGIN).flush(loginResponse());

      expect(localStorage.getItem(TOKEN_KEY)).toBe('access-1');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-1');
      expect(JSON.parse(localStorage.getItem(USER_KEY)!).username).toBe('marketing1');
    });

    it('turns expiresIn seconds into an absolute instant, so later reads need no arithmetic', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));

      service.login(credentials).subscribe();
      backend.expectOne(LOGIN).flush(loginResponse({ expiresIn: 900 }));

      expect(service.getAccessExpiry()).toBe(Date.now() + 900_000);

      vi.useRealTimers();
    });

    it('stores nothing when the response carries no token', () => {
      service.login(credentials).subscribe();
      backend.expectOne(LOGIN).flush(loginResponse({ token: '' }));

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('rethrows a failure so the login page can show it', () => {
      let failed = false;

      service.login(credentials).subscribe({
        error: () => (failed = true),
      });
      backend.expectOne(LOGIN).flush('bad credentials', { status: 401, statusText: 'Unauthorized' });

      expect(failed).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('reading the stored session', () => {
    it('reports a stored token as logged in', () => {
      localStorage.setItem(TOKEN_KEY, 'access-1');
      expect(service.isLoggedIn()).toBe(true);
    });

    it('reports no token as logged out', () => {
      expect(service.isLoggedIn()).toBe(false);
    });

    it('reads back a stored expiry', () => {
      localStorage.setItem(EXPIRY_KEY, '1789391418001');
      expect(service.getAccessExpiry()).toBe(1789391418001);
    });

    it('treats a corrupted expiry as no expiry rather than as the epoch', () => {
      localStorage.setItem(EXPIRY_KEY, 'not-a-number');
      expect(service.getAccessExpiry()).toBeNull();
    });

    it('treats a missing expiry as no expiry', () => {
      expect(service.getAccessExpiry()).toBeNull();
    });
  });

  describe('hasUsableSession', () => {
    const put = (token: string | null, expiry: number | null, refresh: string | null) => {
      localStorage.clear();
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (expiry !== null) localStorage.setItem(EXPIRY_KEY, String(expiry));
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    };

    it('is false with no token at all', () => {
      put(null, Date.now() + 60_000, 'refresh-1');
      expect(service.hasUsableSession()).toBe(false);
    });

    it('is true for a token that has not expired', () => {
      put('access-1', Date.now() + 60_000, 'refresh-1');
      expect(service.hasUsableSession()).toBe(true);
    });

    it('is true for an expired token while a refresh token can still renew it', () => {
      put('access-1', Date.now() - 1000, 'refresh-1');
      expect(service.hasUsableSession()).toBe(true);
    });

    it('is false once the token has expired and nothing can renew it', () => {
      put('access-1', Date.now() - 1000, null);
      expect(service.hasUsableSession()).toBe(false);
    });

    it('is true when no expiry was recorded, since the server is the real judge', () => {
      put('access-1', null, null);
      expect(service.hasUsableSession()).toBe(true);
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      localStorage.setItem(TOKEN_KEY, 'access-1');
      localStorage.setItem(REFRESH_KEY, 'refresh-1');
    });

    it('sends the stored refresh token', () => {
      service.refresh().subscribe();

      const req = backend.expectOne(REFRESH);
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      req.flush(loginResponse());
    });

    it('stores the rotated pair, or the next refresh replays a spent token', () => {
      service.refresh().subscribe();
      backend
        .expectOne(REFRESH)
        .flush(loginResponse({ token: 'access-2', refreshToken: 'refresh-2' }));

      expect(localStorage.getItem(TOKEN_KEY)).toBe('access-2');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-2');
    });

    it('makes one request for two concurrent callers, so a burst of 401s cannot rotate twice', () => {
      const seen: string[] = [];

      service.refresh().subscribe((r) => seen.push(r.token));
      service.refresh().subscribe((r) => seen.push(r.token));

      backend.expectOne(REFRESH).flush(loginResponse({ token: 'access-2' }));

      expect(seen).toEqual(['access-2', 'access-2']);
    });

    it('serves a late subscriber from the same in-flight call', () => {
      const seen: string[] = [];
      const shared = service.refresh();

      shared.subscribe((r) => seen.push(r.token));
      shared.subscribe((r) => seen.push(r.token));

      backend.expectOne(REFRESH).flush(loginResponse({ token: 'access-2' }));

      expect(seen).toHaveLength(2);
    });

    it('starts a fresh call once the previous one has finished', () => {
      service.refresh().subscribe();
      backend.expectOne(REFRESH).flush(loginResponse({ refreshToken: 'refresh-2' }));

      service.refresh().subscribe();
      const second = backend.expectOne(REFRESH);

      expect(second.request.body).toEqual({ refreshToken: 'refresh-2' });
      second.flush(loginResponse());
    });

    it('starts a fresh call after a failure rather than replaying the failed one forever', () => {
      service.refresh().subscribe({ error: () => undefined });
      backend.expectOne(REFRESH).flush('nope', { status: 401, statusText: 'Unauthorized' });

      service.refresh().subscribe({ error: () => undefined });
      backend.expectOne(REFRESH).flush('nope', { status: 401, statusText: 'Unauthorized' });
    });

    it('fails without touching the network when nothing is stored to refresh with', () => {
      localStorage.removeItem(REFRESH_KEY);

      let message = '';
      service.refresh().subscribe({ error: (e: Error) => (message = e.message) });

      expect(message).toContain('No refresh token');
    });
  });

  describe('clearSession', () => {
    it('removes every key the session is made of', () => {
      localStorage.setItem(TOKEN_KEY, 'a');
      localStorage.setItem(REFRESH_KEY, 'b');
      localStorage.setItem(EXPIRY_KEY, '1');
      localStorage.setItem(USER_KEY, '{}');

      service.clearSession();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRY_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('empties the menus, so a stale sidebar cannot outlive the session', () => {
      service.login(credentials).subscribe();
      backend.expectOne(LOGIN).flush(loginResponse());
      expect(service.getMenus()).toHaveLength(1);

      service.clearSession();

      expect(service.getMenus()).toEqual([]);
    });

    it('navigates nowhere on its own', () => {
      service.clearSession();
      expect(navigated).toEqual([]);
    });
  });

  describe('expireSession', () => {
    it('clears the session and sends the user to login', () => {
      localStorage.setItem(TOKEN_KEY, 'a');

      service.expireSession();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(navigated[0].commands).toEqual(['/login']);
    });

    it('records where the user was, and says why they were sent away', () => {
      routerStub.url = '/applications/APP-0001';

      service.expireSession();

      expect(navigated[0].extras).toMatchObject({
        queryParams: { returnUrl: '/applications/APP-0001', reason: 'expired' },
      });
    });

    it('replaces the history entry, so Back does not bounce off the guard again', () => {
      service.expireSession();
      expect(navigated[0].extras).toMatchObject({ replaceUrl: true });
    });
  });

  describe('logout', () => {
    it('tells the server to revoke the refresh token, not only the browser', () => {
      localStorage.setItem(REFRESH_KEY, 'refresh-1');

      service.logout();

      const req = backend.expectOne(LOGOUT);
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      req.flush({});
    });

    it('clears the session even if the server call fails', () => {
      localStorage.setItem(TOKEN_KEY, 'a');
      localStorage.setItem(REFRESH_KEY, 'refresh-1');

      service.logout();
      backend.expectOne(LOGOUT).flush('down', { status: 500, statusText: 'Server Error' });

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('skips the server call when there is no refresh token to revoke', () => {
      service.logout();

      backend.expectNone(LOGOUT);
      expect(navigated[0].commands).toEqual(['/login']);
    });

    it('sends the user to login with no expired reason, since this was deliberate', () => {
      service.logout();
      expect(navigated[0].extras).toBeUndefined();
    });
  });

  describe('menus', () => {
    const signIn = (menus: { menuId: number; menuName: string }[]) => {
      service.login(credentials).subscribe();
      backend.expectOne(LOGIN).flush(loginResponse({ menus }));
    };

    it('matches a menu name ignoring case, because the nav label and the DB row differ', () => {
      signIn([{ menuId: 1, menuName: 'dashboard' }]);
      expect(service.hasMenu('Dashboard')).toBe(true);
    });

    it('does not grant a menu that was never returned', () => {
      signIn([{ menuId: 1, menuName: 'Dashboard' }]);
      expect(service.hasMenu('User')).toBe(false);
    });

    it('grants nothing when no one is signed in', () => {
      expect(service.getMenus()).toEqual([]);
      expect(service.hasMenu('Dashboard')).toBe(false);
    });

    it('does not match on a partial name', () => {
      signIn([{ menuId: 1, menuName: 'Dashboard' }]);
      expect(service.hasMenu('Dash')).toBe(false);
    });
  });

  describe('the public endpoints', () => {
    it('posts a login as a plain request, which is what lets a signed-out visitor reach it', () => {
      service.login(credentials).subscribe();

      const req = backend.expectOne(LOGIN);
      expect(req.request.method).toBe('POST');
      req.flush(loginResponse());
    });

    it('posts a forgot-password request to the auth endpoint', () => {
      service.forgotPassword({ email: 'a@b.test' }).subscribe();
      backend.expectOne(`${AUTH}/forgot-password`).flush({});
    });

    it('posts a reset-password request to the auth endpoint', () => {
      service.resetPassword({ token: 't', newPassword: 'p', confirmPassword: 'p' }).subscribe();
      backend.expectOne(`${AUTH}/reset-password`).flush({});
    });
  });
});

describe('AuthService proactive renewal', () => {
  let backend: HttpTestingController;

  const buildWith = (expiresInMs: number | null, refresh: string | null) => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'access-1');
    if (expiresInMs !== null) {
      localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInMs));
    }
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/dashboard', navigate: () => undefined } },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renews before the token expires rather than waiting for a 401', () => {
    buildWith(60_000, 'refresh-1');

    vi.advanceTimersByTime(40_000);

    backend.expectOne(REFRESH).flush(loginResponse({ token: 'access-2' }));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-2');
  });

  it('does not fire early, so a short-lived token is not thrown away', () => {
    buildWith(60_000, 'refresh-1');

    vi.advanceTimersByTime(39_000);
    backend.expectNone(REFRESH);

    vi.advanceTimersByTime(2_000);
    backend.expectOne(REFRESH).flush(loginResponse());
  });

  it('caps the margin at thirty seconds for a long-lived token', () => {
    buildWith(900_000, 'refresh-1');

    vi.advanceTimersByTime(869_000);
    backend.expectNone(REFRESH);

    vi.advanceTimersByTime(2_000);
    backend.expectOne(REFRESH).flush(loginResponse());
  });

  it('schedules the next renewal from the new expiry, so the session keeps itself alive', () => {
    buildWith(60_000, 'refresh-1');

    vi.advanceTimersByTime(40_000);
    backend.expectOne(REFRESH).flush(loginResponse({ token: 'access-2', expiresIn: 60 }));

    vi.advanceTimersByTime(40_000);
    backend.expectOne(REFRESH).flush(loginResponse({ token: 'access-3', expiresIn: 60 }));

    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-3');
  });

  it('renews immediately when the token is already past its expiry on startup', () => {
    buildWith(-1_000, 'refresh-1');

    vi.advanceTimersByTime(0);

    backend.expectOne(REFRESH).flush(loginResponse());
  });

  it('schedules nothing without a refresh token, since there is nothing to renew with', () => {
    buildWith(60_000, null);

    vi.advanceTimersByTime(120_000);

    backend.expectNone(REFRESH);
  });

  it('schedules nothing when no expiry was recorded', () => {
    buildWith(null, 'refresh-1');

    vi.advanceTimersByTime(120_000);

    backend.expectNone(REFRESH);
  });

  it('stops renewing once the session is cleared', () => {
    const service = buildWith(60_000, 'refresh-1');

    service.clearSession();
    vi.advanceTimersByTime(120_000);

    backend.expectNone(REFRESH);
  });
});
