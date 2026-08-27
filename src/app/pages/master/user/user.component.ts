import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import Swal from 'sweetalert2';

import {
  SortEvent,
  TableColumn,
  TableComponent,
} from '../../../shared/components/table/table.component';

import { Branch } from '../../../models/master/branch.models';
import { Role } from '../../../models/master/role.models';
import { User, UserRequest } from '../../../models/master/user.models';

import { BranchService } from '../../../core/services/master/branch.services';
import { RolesService } from '../../../core/services/master/roles.services';
import { UserService } from '../../../core/services/master/user.services';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule, LoadingComponent],
  templateUrl: './user.component.html',
})
export class UserComponent implements OnInit {
  spinner = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  // Dropdown sources — unpaginated, loaded once.
  roles = signal<Role[]>([]);
  branches = signal<Branch[]>([]);

  // One page of users.
  users = signal<User[]>([]);
  totalElements = signal(0);

  loading = signal(false);
  submitting = signal(false);
  modalOpen = signal(false);

  editingUserId: string | null = null;

  // SEARCH
  search = '';

  // PAGINATION — 1-based here, converted to the API's zero-based page on request.
  currentPage = 1;
  pageSize = 5;

  // SORTING
  sortBy = 'username';
  sortDir: 'asc' | 'desc' = 'asc';

  userForm;

  columns: TableColumn[] = [
    {
      key: 'userId',
      label: 'User ID',
      type: 'text',
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      sortable: true,
    },
    {
      key: 'fullName',
      label: 'Name',
      type: 'text',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      sortable: true,
    },
    {
      key: 'roleName',
      label: 'Role',
      type: 'text',
      sortable: true,
      sortKey: 'role.roleName',
    },
    {
      key: 'phoneNumber',
      label: 'Phone Number',
      type: 'text',
      sortable: true,
    },
    {
      key: 'branchName',
      label: 'Branch',
      type: 'text',
      sortable: true,
      sortKey: 'branch.branchName',
    },
    {
      key: 'isActive',
      label: 'Status',
      type: 'status',
    },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly branchService: BranchService,
    private readonly roleService: RolesService,
    private readonly userService: UserService,
  ) {
    this.userForm = this.fb.group({
      username: ['', Validators.required],

      email: ['', [Validators.required, Validators.email]],

      password: ['', Validators.required],

      fullName: ['', Validators.required],

      phoneNumber: ['', Validators.required],

      roleId: this.fb.control<number | null>(null, Validators.required),

      branchId: this.fb.control<number | null>(null, Validators.required),
    });
  }

  ngOnInit(): void {

    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadUsers();
      });

    this.loadUsers();
    this.loadRoles();
    this.loadBranches();
  }

  // TABLE EVENT HANDLERS
  onSearch(): void {
    this.searchInput$.next(this.search);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadUsers();
  }

  onSortChange(event: SortEvent): void {
    this.sortBy = event.sortBy;
    this.sortDir = event.sortDir;
    this.currentPage = 1;
    this.loadUsers();
  }

  // LOAD USERS
  loadUsers(): void {
    this.loading.set(true);

    this.userService
      .getAllUsers({
        page: this.currentPage - 1,
        size: this.pageSize,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search.trim(),
      })
      .subscribe({
        next: (response) => {
          const page = response?.data;

          this.users.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);

          // Deleting the last row on the last page can strand us past the end.
          const lastPage = Math.max(1, page?.totalPages ?? 1);

          if (this.currentPage > lastPage) {
            this.currentPage = lastPage;
            this.loadUsers();
            return;
          }

          this.loading.set(false);
        },

        error: (error: HttpErrorResponse) => {
          console.error('Error loading users:', error);

          this.users.set([]);
          this.totalElements.set(0);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: error?.error?.message ?? 'Failed to load users.',
          });
        },
      });
  }

  // LOAD ROLES (dropdown — unpaginated)
  loadRoles(): void {
    this.roleService.getRoleOptions().subscribe({
      next: (response) => {
        this.roles.set(response?.data ?? []);
      },

      error: (error: HttpErrorResponse) => {
        console.error('Error loading roles:', error);
      },
    });
  }

  // LOAD BRANCHES (dropdown — unpaginated)
  loadBranches(): void {
    this.branchService.getAllBranches().subscribe({
      next: (response) => {
        this.branches.set(response?.data?.content ?? []);
      },

      error: (error: HttpErrorResponse) => {
        console.error('Error loading branches:', error);
      },
    });
  }

  // ADD USER
  addUser(): void {
    this.editingUserId = null;

    this.userForm.reset({
      username: '',
      email: '',
      password: '',
      fullName: '',
      phoneNumber: '',
      roleId: null,
      branchId: null,
    });

    // Password required when creating
    const passwordControl = this.userForm.get('password');

    passwordControl?.setValidators([Validators.required]);

    passwordControl?.updateValueAndValidity();

    this.modalOpen.set(true);
  }

  // EDIT USER

  editUser(user: User): void {
    this.editingUserId = user.userId ?? null;

    this.userForm.patchValue({
      username: user.username ?? '',
      email: user.email ?? '',
      password: '',
      fullName: user.fullName ?? '',
      phoneNumber: user.phoneNumber ?? '',
      roleId: user.roleId ?? null,
      branchId: user.branchId ?? null,
    });

    // Password is optional when editing
    const passwordControl = this.userForm.get('password');

    passwordControl?.clearValidators();
    passwordControl?.updateValueAndValidity();

    this.modalOpen.set(true);
  }

  // CLOSE MODAL

  closeModal(): void {
    if (this.submitting()) {
      return;
    }

    this.modalOpen.set(false);
    this.editingUserId = null;

    this.userForm.reset({
      username: '',
      email: '',
      password: '',
      fullName: '',
      phoneNumber: '',
      roleId: null,
      branchId: null,
    });
  }

  // SAVE USER
  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const formValue = this.userForm.getRawValue();

    const request: UserRequest = {
      username: formValue.username ?? '',
      email: formValue.email ?? '',
      fullName: formValue.fullName ?? '',
      phoneNumber: formValue.phoneNumber ?? '',

      accountType: 'USER',

      roleId: Number(formValue.roleId),
      branchId: Number(formValue.branchId),
    };

    // Only send password if user entered one
    if (formValue.password) {
      request.password = formValue.password;
    }

    // UPDATE

    if (this.editingUserId !== null) {
      this.userService.updateUser(this.editingUserId, request).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();

          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'User updated successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          // Stay on the current page — the edited row is still there.
          this.loadUsers();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to update user:', error);

          this.submitting.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error?.error?.message ?? 'Failed to update user.',
          });
        },
      });

      return;
    }

    // CREATE
    this.userService.createUser(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();

        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: 'User created successfully.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.currentPage = 1;
        this.loadUsers();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create user:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: error?.error?.message ?? 'Failed to create user.',
        });
      },
    });
  }

  // DELETE USER

  deleteUser(user: User): void {
    const userId = user.userId;

    if (userId === undefined) {
      console.error('User ID is missing.');
      return;
    }

    Swal.fire({
      title: 'Delete User?',
      text: `Are you sure you want to delete "${user.fullName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.userService.deleteUser(userId).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'User deleted successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadUsers();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete user:', error);

          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: error?.error?.message ?? 'Failed to delete user.',
          });
        },
      });
    });
  }
}
