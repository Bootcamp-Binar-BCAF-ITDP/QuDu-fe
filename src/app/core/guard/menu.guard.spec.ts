import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { AuthService } from '../services/auth.services';
import { menuGuard } from './menu.guard';

describe('menuGuard', () => {
  const configure = (granted: string[]) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            hasMenu: (name: string) =>
              granted.some((g) => g.toLowerCase() === name.toLowerCase()),
          },
        },
        {
          provide: Router,
          useValue: { createUrlTree: (commands: unknown[]) => ({ commands }) as never },
        },
      ],
    });
  };

  const run = (data: Record<string, unknown> | undefined) =>
    TestBed.runInInjectionContext(() =>
      menuGuard({ data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  it('lets a user with the menu through', () => {
    configure(['Role']);
    expect(run({ menu: 'Role' })).toBe(true);
  });

  it('turns away a user without it', () => {
    configure([]);
    expect(run({ menu: 'Role' })).not.toBe(true);
  });

  it('sends the refused user to the forbidden page, not back to login', () => {
    configure([]);
    const result = run({ menu: 'Role' }) as unknown as { commands: unknown[] };

    expect(result.commands).toEqual(['/forbidden']);
  });

  it('matches the menu name case insensitively, since the label and the DB row differ in case', () => {
    configure(['role']);
    expect(run({ menu: 'Role' })).toBe(true);
  });

  it('waves through a route that declares no menu, which is every route in the table today', () => {
    configure([]);
    expect(run({})).toBe(true);
  });

  it('waves through a route with no data at all', () => {
    configure([]);
    expect(run(undefined)).toBe(true);
  });

  it('waves through an empty menu name rather than refusing on a blank', () => {
    configure([]);
    expect(run({ menu: '' })).toBe(true);
  });
});
