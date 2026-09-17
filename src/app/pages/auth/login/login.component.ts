import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.services';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../shared/utils/api-message.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loading = signal(false);
  showPassword = false;
  errorMessage = '';

  loginForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const request = {
      usernameOrEmail: this.loginForm.get('usernameOrEmail')?.value ?? '',

      password: this.loginForm.get('password')?.value ?? '',

      accountType: 'USER',
    };

    this.authService.login(request)
      .pipe(finalize(() => (this.loading.set(false))))
      .subscribe({
        next: (response) => {
          this.loading.set(false);

          if (response.token) {
            this.router.navigate(['/dashboard']);
          } else {
            this.errorMessage = 'Login failed. Token was not received.';
          }
        },
        error: (error: HttpErrorResponse) => {
          console.error('Login error:', error);

          this.loading.set(false);

          if (error.status === 401) {
            this.errorMessage = 'Invalid username/email or password.';
          } else if (error.status === 0) {
            this.errorMessage = 'Cannot connect to the server.';
          } else {
            this.errorMessage = apiErrorMessage(error, 'An unexpected error occurred.');
          }
        },
      });
  }
}
