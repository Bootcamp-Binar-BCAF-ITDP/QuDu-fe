import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.services';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let router: Router;

  const run = () =>
    TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));

  const configure = (session: Partial<AuthService>) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: session },
        {
          provide: Router,
          useValue: { createUrlTree: (commands: unknown[]) => ({ commands }) as never },
        },
      ],
    });
    router = TestBed.inject(Router);
  };

  const session = (over: Partial<Record<string, unknown>> = {}) => {
    const token = 'token' in over ? over['token'] : 'access';
    const expiry = 'expiry' in over ? over['expiry'] : Date.now() + 60_000;
    const refresh = 'refresh' in over ? over['refresh'] : 'refresh';

    const stub: Partial<AuthService> = {
      getToken: () => token as string | null,
      getAccessExpiry: () => expiry as number | null,
      getRefreshToken: () => refresh as string | null,
    };

    stub.hasUsableSession = AuthService.prototype.hasUsableSession.bind(stub);
    return stub;
  };

  it('lets a signed-out visitor reach the login page', () => {
    configure(session({ token: null }));
    expect(run()).toBe(true);
  });

  it('turns a signed-in user away from the login page', () => {
    configure(session());
    expect(run()).not.toBe(true);
  });

  it('sends them to the app root, so the routing table decides where home is', () => {
    configure(session());
    const result = run() as unknown as { commands: unknown[] };
    expect(result.commands).toEqual(['/']);
  });

  it('lets someone back in once the token is gone and nothing can renew it', () => {
    configure(session({ expiry: Date.now() - 1000, refresh: null }));
    expect(run()).toBe(true);
  });

  it('still turns them away when the token expired but a refresh token remains', () => {
    configure(session({ expiry: Date.now() - 1000, refresh: 'refresh' }));
    expect(run()).not.toBe(true);
  });

  it('treats a session with no recorded expiry as usable', () => {
    configure(session({ expiry: null }));
    expect(run()).not.toBe(true);
  });

  it('lets a visitor with no token in at all, whatever else is stored', () => {
    configure(session({ token: null, expiry: Date.now() + 60_000, refresh: 'refresh' }));
    expect(run()).toBe(true);
  });
});
