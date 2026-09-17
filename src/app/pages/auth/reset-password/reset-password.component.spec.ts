import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.services';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let requests: unknown[];
  let responses: Subject<any>;
  let navigated: unknown[][];
  let failWith: unknown = null;

  const build = (token: string | null = 'tok-123') => {
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
            resetPassword: (body: unknown) => {
              requests.push(body);
              return failWith ? throwError(() => failWith) : responses.asObservable();
            },
          },
        },
        { provide: Router, useValue: { navigate: (c: unknown[]) => navigated.push(c) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => token } } },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () =>
        new ResetPasswordComponent(
          TestBed.inject(FormBuilder),
          TestBed.inject(AuthService),
          TestBed.inject(ActivatedRoute),
          TestBed.inject(Router),
        ),
    );
    component.ngOnInit();
  };

  const fill = (newPassword: string, confirmPassword = newPassword) =>
    component.resetPasswordForm.setValue({ newPassword, confirmPassword });

  beforeEach(() => build());

  describe('the token', () => {
    it('is taken from the path segment, matching the link the backend emails', () => {
      expect(component.token).toBe('tok-123');
    });

    it('complains straight away when the link carried no token', () => {
      build(null);

      expect(component.token).toBe('');
      expect(component.errorMessage).toBe('Invalid or missing reset token.');
    });

    it('refuses to submit without one, even if the form is filled in', () => {
      build(null);
      fill('longenough123');

      component.resetPassword();

      expect(requests).toEqual([]);
      expect(component.errorMessage).toBe('Invalid or missing reset token.');
    });
  });

  describe('the form', () => {
    it('starts empty and invalid', () => {
      expect(component.resetPasswordForm.value).toEqual({
        newPassword: '',
        confirmPassword: '',
      });
      expect(component.resetPasswordForm.invalid).toBe(true);
    });

    it('needs at least eight characters', () => {
      fill('short');
      expect(component.resetPasswordForm.invalid).toBe(true);

      fill('longenough');
      expect(component.resetPasswordForm.valid).toBe(true);
    });

    it('needs the confirmation filled in', () => {
      component.resetPasswordForm.setValue({ newPassword: 'longenough', confirmPassword: '' });
      expect(component.resetPasswordForm.invalid).toBe(true);
    });
  });

  describe('the two password fields', () => {
    it('both start hidden and toggle independently', () => {
      expect(component.showPassword).toBe(false);
      expect(component.showConfirmPassword).toBe(false);

      component.togglePassword();

      expect(component.showPassword).toBe(true);
      expect(component.showConfirmPassword).toBe(false);

      component.toggleConfirmPassword();

      expect(component.showConfirmPassword).toBe(true);
    });
  });

  describe('submitting', () => {
    it('sends nothing while the form is invalid', () => {
      fill('short');
      component.resetPassword();

      expect(requests).toEqual([]);
    });

    it('marks the fields touched so the errors become visible', () => {
      fill('short');
      component.resetPassword();

      expect(component.resetPasswordForm.get('newPassword')?.touched).toBe(true);
    });

    it('refuses when the two passwords differ, before reaching the server', () => {
      fill('longenough123', 'different123');
      component.resetPassword();

      expect(requests).toEqual([]);
      expect(component.errorMessage).toBe('Passwords do not match.');
    });

    it('sends the token and both passwords once everything lines up', () => {
      fill('longenough123');
      component.resetPassword();

      expect(requests).toEqual([
        { token: 'tok-123', newPassword: 'longenough123', confirmPassword: 'longenough123' },
      ]);
    });

    it('spins while the request is in flight', () => {
      fill('longenough123');
      component.resetPassword();

      expect(component.loading).toBe(true);
    });

    it('shows the server message on success', () => {
      fill('longenough123');
      component.resetPassword();
      responses.next({ message: 'Password changed.' });

      expect(component.loading).toBe(false);
      expect(component.successMessage).toBe('Password changed.');
    });

    it('falls back to its own wording when the server sends none', () => {
      fill('longenough123');
      component.resetPassword();
      responses.next({});

      expect(component.successMessage).toBe('Password reset successfully.');
    });

    it('sends the user to login after a pause, so the message can be read first', () => {
      vi.useFakeTimers();

      fill('longenough123');
      component.resetPassword();
      responses.next({ message: 'Done.' });

      expect(navigated).toEqual([]);

      vi.advanceTimersByTime(2000);

      expect(navigated).toEqual([['/login']]);
      vi.useRealTimers();
    });

    it('shows the server error when the token has expired', () => {
      failWith = { error: { message: 'Token expired.' } };
      fill('longenough123');
      component.resetPassword();

      expect(component.loading).toBe(false);
      expect(component.errorMessage).toBe('Token expired.');
    });

    it('falls back to wording that names the likely cause', () => {
      failWith = { status: 500 };
      fill('longenough123');
      component.resetPassword();

      expect(component.errorMessage).toContain('invalid or expired');
    });

    it('navigates nowhere on a failure', () => {
      vi.useFakeTimers();

      failWith = { status: 400 };
      fill('longenough123');
      component.resetPassword();
      vi.advanceTimersByTime(5000);

      expect(navigated).toEqual([]);
      vi.useRealTimers();
    });

    it('clears both messages before trying again', () => {
      failWith = { error: { message: 'boom' } };
      fill('longenough123');
      component.resetPassword();
      expect(component.errorMessage).toBe('boom');

      failWith = null;
      component.resetPassword();

      expect(component.errorMessage).toBe('');
      expect(component.successMessage).toBe('');
    });
  });
});
