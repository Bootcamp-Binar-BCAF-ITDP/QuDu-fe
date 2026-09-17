import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.services';
import { apiErrorMessage } from '../../../shared/utils/api-message.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  loading = false;
  errorMessage = '';
  successMessage = '';

  forgotPasswordForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const request = {
      email: this.forgotPasswordForm.value.email ?? '',
    };

    this.authService.forgotPassword(request).subscribe({
      next: (response) => {
        this.loading = false;

        this.successMessage =
          response.message ?? 'Password reset instructions have been sent to your email.';
      },

      error: (error) => {
        console.error('Forgot password error:', error);

        this.loading = false;

        this.errorMessage =
          apiErrorMessage(error, 'An error occurred. Please try again.');
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
