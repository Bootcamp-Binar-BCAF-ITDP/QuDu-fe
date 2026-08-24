import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.services';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loading = false;
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

    this.loading = true;

    const request = {
      usernameOrEmail: this.loginForm.get('usernameOrEmail')?.value ?? '',

      password: this.loginForm.get('password')?.value ?? '',

      accountType: 'USER',
    };

    this.authService.login(request).subscribe({
      next: (response) => {
        this.loading = false;

        if (response.token) {
          this.router.navigate(['/applications']);
        } else {
          this.errorMessage = 'Login failed. Token was not received.';
        }
      },

      error: (error: HttpErrorResponse) => {
        console.error('Login error:', error);

        this.loading = false;

        if (error.status === 401) {
          this.errorMessage = 'Invalid username/email or password.';
        } else if (error.status === 0) {
          this.errorMessage = 'Cannot connect to the server.';
        } else {
          this.errorMessage = error.error?.message || 'An unexpected error occurred.';
        }
      },
    });
  }
}
