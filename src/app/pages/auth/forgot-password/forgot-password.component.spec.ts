import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.services';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
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
            forgotPassword: (body: unknown) => {
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
        new ForgotPasswordComponent(
          TestBed.inject(FormBuilder),
          TestBed.inject(AuthService),
          TestBed.inject(Router),
        ),
    );
  };

  beforeEach(() => build());

  const typeEmail = (email: string) => component.forgotPasswordForm.setValue({ email });

  describe('the form', () => {
    it('starts empty and invalid, so the button cannot submit nothing', () => {
      expect(component.forgotPasswordForm.value).toEqual({ email: '' });
      expect(component.forgotPasswordForm.invalid).toBe(true);
    });

    it('rejects a malformed address', () => {
      typeEmail('not-an-email');
      expect(component.forgotPasswordForm.invalid).toBe(true);
    });

    it('accepts a well formed address', () => {
      typeEmail('budi@qudu.test');
      expect(component.forgotPasswordForm.valid).toBe(true);
    });
  });

  describe('submitting', () => {
    it('sends nothing while the form is invalid', () => {
      component.submit();
      expect(requests).toEqual([]);
    });

    it('marks the field touched so the error becomes visible', () => {
      component.submit();
      expect(component.forgotPasswordForm.get('email')?.touched).toBe(true);
    });

    it('does not spin when it refused to send', () => {
      component.submit();
      expect(component.loading).toBe(false);
    });

    it('sends the address once the form is valid', () => {
      typeEmail('budi@qudu.test');
      component.submit();

      expect(requests).toEqual([{ email: 'budi@qudu.test' }]);
    });

    it('spins while the request is in flight', () => {
      typeEmail('budi@qudu.test');
      component.submit();

      expect(component.loading).toBe(true);
    });

    it('stops spinning and shows the server message on success', () => {
      typeEmail('budi@qudu.test');
      component.submit();
      responses.next({ message: 'Check your inbox.' });

      expect(component.loading).toBe(false);
      expect(component.successMessage).toBe('Check your inbox.');
    });

    it('falls back to its own wording when the server sends no message', () => {
      typeEmail('budi@qudu.test');
      component.submit();
      responses.next({});

      expect(component.successMessage).toContain('reset instructions');
    });

    it('shows the server error when the request fails', () => {
      failWith = { error: { message: 'No account with that email.' } };
      typeEmail('budi@qudu.test');
      component.submit();

      expect(component.loading).toBe(false);
      expect(component.errorMessage).toBe('No account with that email.');
    });

    it('falls back to generic wording when the failure carries no message', () => {
      failWith = { status: 500 };
      typeEmail('budi@qudu.test');
      component.submit();

      expect(component.errorMessage).toBe('An error occurred. Please try again.');
    });

    it('clears an earlier error before trying again', () => {
      failWith = { error: { message: 'boom' } };
      typeEmail('budi@qudu.test');
      component.submit();
      expect(component.errorMessage).toBe('boom');

      failWith = null;
      component.submit();

      expect(component.errorMessage).toBe('');
    });

    it('clears an earlier success before trying again, so two messages never show at once', () => {
      typeEmail('budi@qudu.test');
      component.submit();
      responses.next({ message: 'Sent.' });

      component.submit();

      expect(component.successMessage).toBe('');
    });
  });

  it('offers a way back to the login page', () => {
    component.goToLogin();
    expect(navigated).toEqual([['/login']]);
  });
});
