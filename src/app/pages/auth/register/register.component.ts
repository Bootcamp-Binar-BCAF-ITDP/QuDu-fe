import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.services';
import { Role } from '../../../models/master/role.models';
import { Branch } from '../../../models/master/branch.models';
import { apiErrorMessage } from '../../../shared/utils/api-message.util';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  loading = false;
  loadingData = false;
  showPassword = false;
  errorMessage = '';

  roles = signal<Role[]>([]);
  branches = signal<Branch[]>([]);

  registerForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      fullName: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      roleId: [null, Validators.required],
      branchId: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadBranches();
  }

  loadRoles(): void {
    this.loadingData = true;

    this.authService.getRoles().subscribe({
      next: (response) => {
        this.roles.set(response.data ?? []);
        this.loadingData = false;
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.errorMessage = 'Failed to load roles.';
        this.loadingData = false;
      },
    });
  }

  loadBranches(): void {
    this.authService.getBranches().subscribe({
      next: (response) => {
        this.branches.set(response.data ?? []);
        this.loadingData = false;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.errorMessage = 'Failed to load branches.';
        this.loadingData = false;
      },
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  register(): void {
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const request = {
      username: this.registerForm.value.username ?? '',
      email: this.registerForm.value.email ?? '',
      password: this.registerForm.value.password ?? '',
      fullName: this.registerForm.value.fullName ?? '',
      accountType: 'USER',
      phoneNumber: this.registerForm.value.phoneNumber ?? '',
      roleId: Number(this.registerForm.value.roleId),
      branchId: Number(this.registerForm.value.branchId),
    };

    this.authService.register(request).subscribe({
      next: (response) => {
        this.loading = false;

        this.registerForm.reset();
      },

      error: (error) => {
        console.error('Registration error:', error);
        this.loading = false;

        if (error.error?.message) {
          this.errorMessage = apiErrorMessage(error, 'Registration failed. Please try again.');
        } else {
          this.errorMessage = 'An error occurred during registration. Please try again.';
        }
      },
    });
  }
}
