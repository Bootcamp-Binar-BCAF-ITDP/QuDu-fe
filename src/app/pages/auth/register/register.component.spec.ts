import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.services';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;

  let roles$: Subject<any>;
  let branches$: Subject<any>;
  let register$: Subject<any>;

  let registered: unknown[];
  let rolesFail: unknown = null;
  let branchesFail: unknown = null;
  let registerFail: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    roles$ = new Subject<any>();
    branches$ = new Subject<any>();
    register$ = new Subject<any>();

    registered = [];
    rolesFail = null;
    branchesFail = null;
    registerFail = null;

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: AuthService,
          useValue: {
            getRoles: () => (rolesFail ? throwError(() => rolesFail) : roles$.asObservable()),
            getBranches: () =>
              branchesFail ? throwError(() => branchesFail) : branches$.asObservable(),
            register: (body: unknown) => {
              registered.push(body);
              return registerFail ? throwError(() => registerFail) : register$.asObservable();
            },
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new RegisterComponent(TestBed.inject(FormBuilder), TestBed.inject(AuthService)),
    );
  };

  const fill = (over: Record<string, unknown> = {}) =>
    component.registerForm.setValue({
      username: 'budi',
      email: 'budi@qudu.test',
      password: 'secret',
      fullName: 'Budi Santoso',
      phoneNumber: '08120000000',
      roleId: 2,
      branchId: 3,
      ...over,
    } as never);

  beforeEach(() => build());

  describe('the form', () => {
    it('starts empty and invalid', () => {
      expect(component.registerForm.invalid).toBe(true);
    });

    it('requires every field, including the role and the branch', () => {
      for (const field of [
        'username',
        'email',
        'password',
        'fullName',
        'phoneNumber',
        'roleId',
        'branchId',
      ]) {
        fill({ [field]: field === 'roleId' || field === 'branchId' ? null : '' });
        expect(component.registerForm.invalid, `${field} is not required`).toBe(true);
      }
    });

    it('rejects a malformed email', () => {
      fill({ email: 'not-an-email' });
      expect(component.registerForm.invalid).toBe(true);
    });

    it('is valid once everything is filled in', () => {
      fill();
      expect(component.registerForm.valid).toBe(true);
    });
  });

  describe('loading the dropdowns', () => {
    it('asks for roles and branches on init', () => {
      component.ngOnInit();

      roles$.next({ data: [{ roleId: 1, roleName: 'MARKETING' }] });
      branches$.next({ data: [{ branchId: 1, branchName: 'Jakarta' }] });

      expect(component.roles()).toHaveLength(1);
      expect(component.branches()).toHaveLength(1);
    });

    it('treats a missing data field as an empty list rather than crashing the select', () => {
      component.ngOnInit();

      roles$.next({});
      branches$.next({});

      expect(component.roles()).toEqual([]);
      expect(component.branches()).toEqual([]);
    });

    it('reports a failure to load roles', () => {
      rolesFail = { status: 403 };
      component.ngOnInit();

      expect(component.errorMessage).toBe('Failed to load roles.');
      expect(component.loadingData).toBe(false);
    });

    it('reports a failure to load branches', () => {
      branchesFail = { status: 403 };
      component.loadBranches();

      expect(component.errorMessage).toBe('Failed to load branches.');
      expect(component.loadingData).toBe(false);
    });

    it('leaves the lists empty when the endpoints refuse, which is what an anonymous visitor sees', () => {
      rolesFail = { status: 403 };
      branchesFail = { status: 403 };
      component.ngOnInit();

      expect(component.roles()).toEqual([]);
      expect(component.branches()).toEqual([]);
    });
  });

  describe('the password toggle', () => {
    it('flips each time it is pressed', () => {
      expect(component.showPassword).toBe(false);

      component.togglePassword();
      expect(component.showPassword).toBe(true);

      component.togglePassword();
      expect(component.showPassword).toBe(false);
    });
  });

  describe('registering', () => {
    it('sends nothing while the form is invalid', () => {
      component.register();
      expect(registered).toEqual([]);
    });

    it('marks the fields touched so the errors become visible', () => {
      component.register();
      expect(component.registerForm.get('username')?.touched).toBe(true);
    });

    it('sends the account type the staff app uses', () => {
      fill();
      component.register();

      expect(registered).toHaveLength(1);
      expect((registered[0] as { accountType: string }).accountType).toBe('USER');
    });

    it('converts the select values to numbers, since a select yields strings', () => {
      fill({ roleId: '2', branchId: '3' });
      component.register();

      const body = registered[0] as { roleId: unknown; branchId: unknown };
      expect(body.roleId).toBe(2);
      expect(body.branchId).toBe(3);
    });

    it('spins while the request is in flight', () => {
      fill();
      component.register();

      expect(component.loading).toBe(true);
    });

    it('clears the form on success, so the next user starts fresh', () => {
      fill();
      component.register();
      register$.next({ userId: 'U-1' });

      expect(component.loading).toBe(false);
      expect(component.registerForm.value.username).toBeNull();
    });

    it('shows the server message when registration is refused', () => {
      registerFail = { error: { message: 'Username already taken.' } };
      fill();
      component.register();

      expect(component.errorMessage).toBe('Username already taken.');
      expect(component.loading).toBe(false);
    });

    it('falls back to generic wording when the failure carries no message', () => {
      registerFail = { status: 500 };
      fill();
      component.register();

      expect(component.errorMessage).toContain('An error occurred during registration');
    });

    it('keeps what the user typed when registration fails, so it need not be retyped', () => {
      registerFail = { status: 500 };
      fill();
      component.register();

      expect(component.registerForm.value.username).toBe('budi');
    });

    it('clears the previous error before trying again', () => {
      registerFail = { error: { message: 'boom' } };
      fill();
      component.register();
      expect(component.errorMessage).toBe('boom');

      registerFail = null;
      component.register();

      expect(component.errorMessage).toBe('');
    });
  });
});
