import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.services';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let requests: unknown[];
  let responses: Subject<any>;
  let navigated: unknown[][];
  let failWith: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    requests = [];
    responses = new Subject<any>();
    navigated = [];
    failWith = null;

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: AuthService,
          useValue: {
            login: (body: unknown) => {
              requests.push(body);
              return failWith ? throwError(() => failWith) : responses.asObservable();
            },
          },
        },
        { provide: Router, useValue: { navigate: (c: unknown[]) => navigated.push(c) } },
      ],
    });

    component = TestBed.runInInjectionContext(
      () =>
        new LoginComponent(
          TestBed.inject(FormBuilder),
          TestBed.inject(AuthService),
          TestBed.inject(Router),
        ),
    );
  };

  const fill = (usernameOrEmail = 'budi', password = 'secret') =>
    component.loginForm.setValue({ usernameOrEmail, password });

  const httpError = (status: number, message?: string) =>
    new HttpErrorResponse({ status, error: message ? { message } : null });

  beforeEach(() => build());

  describe('the form', () => {
    it('starts empty and invalid', () => {
      expect(component.loginForm.value).toEqual({ usernameOrEmail: '', password: '' });
      expect(component.loginForm.invalid).toBe(true);
    });

    it('needs both fields', () => {
      component.loginForm.setValue({ usernameOrEmail: 'budi', password: '' });
      expect(component.loginForm.invalid).toBe(true);

      component.loginForm.setValue({ usernameOrEmail: '', password: 'secret' });
      expect(component.loginForm.invalid).toBe(true);
    });

    it('accepts a username as well as an email, since the backend takes either', () => {
      fill('budi', 'secret');
      expect(component.loginForm.valid).toBe(true);

      fill('budi@qudu.test', 'secret');
      expect(component.loginForm.valid).toBe(true);
    });
  });

  describe('the password toggle', () => {
    it('starts hidden', () => {
      expect(component.showPassword).toBe(false);
    });

    it('flips each time it is pressed', () => {
      component.togglePassword();
      expect(component.showPassword).toBe(true);

      component.togglePassword();
      expect(component.showPassword).toBe(false);
    });
  });

  describe('signing in', () => {
    it('sends nothing while the form is invalid', () => {
      component.login();
      expect(requests).toEqual([]);
    });

    it('marks the fields touched so the errors become visible', () => {
      component.login();

      expect(component.loginForm.get('usernameOrEmail')?.touched).toBe(true);
      expect(component.loginForm.get('password')?.touched).toBe(true);
    });

    it('sends the credentials with the USER account type the staff app uses', () => {
      fill();
      component.login();

      expect(requests).toEqual([
        { usernameOrEmail: 'budi', password: 'secret', accountType: 'USER' },
      ]);
    });

    it('spins while the request is in flight', () => {
      fill();
      component.login();

      expect(component.loading()).toBe(true);
    });

    it('goes to the dashboard once a token comes back', () => {
      fill();
      component.login();
      responses.next({ token: 'access-1' });

      expect(navigated).toEqual([['/dashboard']]);
      expect(component.loading()).toBe(false);
    });

    it('complains rather than navigating when the response carries no token', () => {
      fill();
      component.login();
      responses.next({});

      expect(navigated).toEqual([]);
      expect(component.errorMessage).toContain('Token was not received');
    });

    it('says the credentials were wrong on a 401, not something generic', () => {
      failWith = httpError(401);
      fill();
      component.login();

      expect(component.errorMessage).toBe('Invalid username/email or password.');
    });

    it('says the server is unreachable on status zero, which is a network failure', () => {
      failWith = httpError(0);
      fill();
      component.login();

      expect(component.errorMessage).toBe('Cannot connect to the server.');
    });

    it('shows the server message for any other failure', () => {
      failWith = httpError(423, 'Account locked.');
      fill();
      component.login();

      expect(component.errorMessage).toBe('Account locked.');
    });

    it('falls back to generic wording when the failure carries no message', () => {
      failWith = httpError(500);
      fill();
      component.login();

      expect(component.errorMessage).toBe('An unexpected error occurred.');
    });

    it('stops spinning after a failure, so the button is usable again', () => {
      failWith = httpError(401);
      fill();
      component.login();

      expect(component.loading()).toBe(false);
    });

    it('clears the previous error before trying again', () => {
      failWith = httpError(401);
      fill();
      component.login();
      expect(component.errorMessage).not.toBe('');

      failWith = null;
      component.login();

      expect(component.errorMessage).toBe('');
    });

    it('navigates nowhere on a failure', () => {
      failWith = httpError(401);
      fill();
      component.login();

      expect(navigated).toEqual([]);
    });
  });
});
