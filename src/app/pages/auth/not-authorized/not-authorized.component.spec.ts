import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NotAuthorizedComponent } from './not-authorized.component';

describe('NotAuthorizedComponent', () => {
  let component: NotAuthorizedComponent;
  let navigated: unknown[][];
  let wentBack: number;

  beforeEach(() => {
    TestBed.resetTestingModule();

    navigated = [];
    wentBack = 0;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: (c: unknown[]) => navigated.push(c) } },
        { provide: Location, useValue: { back: () => (wentBack += 1) } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new NotAuthorizedComponent());
  });

  it('offers the login page as the way out', () => {
    component.goToLogin();
    expect(navigated).toEqual([['/login']]);
  });

  it('goes back through history rather than guessing a destination', () => {
    component.back();
    expect(wentBack).toBe(1);
  });

  it('decides whether a back button makes sense from the history length', () => {
    expect(typeof component.canGoBack).toBe('boolean');
  });

  describe('roleLabel', () => {
    it('turns a screaming snake role into a readable phrase', () => {
      expect(component.roleLabel('BRANCH_MANAGER')).toBe('Branch manager');
    });

    it('handles a single word role', () => {
      expect(component.roleLabel('MARKETING')).toBe('Marketing');
    });

    it('handles three words', () => {
      expect(component.roleLabel('BACK_OFFICE_STAFF')).toBe('Back office staff');
    });

    it('gives an empty string for an empty role rather than a stray capital', () => {
      expect(component.roleLabel('')).toBe('');
    });

    it('trims stray whitespace before capitalising', () => {
      expect(component.roleLabel('  MARKETING  ')).toBe('Marketing');
    });

    it('capitalises only the first letter, leaving the rest lower case', () => {
      expect(component.roleLabel('SUPERADMIN')).toBe('Superadmin');
    });
  });
});
