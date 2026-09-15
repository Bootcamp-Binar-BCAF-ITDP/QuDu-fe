import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { AuthService } from '../services/auth.services';
import { authGuard } from './auth.guard';

interface UrlTreeStub {
  commands: unknown[];
  extras: { queryParams?: Record<string, unknown> };
}

describe('authGuard', () => {
  const configure = (loggedIn: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: unknown[], extras: UrlTreeStub['extras'] = {}) =>
              ({ commands, extras }) as never,
          },
        },
      ],
    });
  };

  const run = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );

  it('lets a signed-in user through', () => {
    configure(true);
    expect(run('/dashboard')).toBe(true);
  });

  it('turns a signed-out visitor away', () => {
    configure(false);
    expect(run('/dashboard')).not.toBe(true);
  });

  it('sends them to the login page rather than the forbidden page', () => {
    configure(false);
    expect((run('/dashboard') as unknown as UrlTreeStub).commands).toEqual(['/login']);
  });

  it('remembers where they were heading, so login can put them back there', () => {
    configure(false);
    const result = run('/applications/APP-0001') as unknown as UrlTreeStub;

    expect(result.extras.queryParams).toEqual({ returnUrl: '/applications/APP-0001' });
  });

  it('carries the query string of the attempted URL into returnUrl', () => {
    configure(false);
    const result = run('/applications?page=3&status=VERIFIED') as unknown as UrlTreeStub;

    expect(result.extras.queryParams).toEqual({
      returnUrl: '/applications?page=3&status=VERIFIED',
    });
  });

  it('redirects rather than returning false, so the user lands somewhere useful', () => {
    configure(false);
    expect(run('/dashboard')).not.toBe(false);
  });
});
