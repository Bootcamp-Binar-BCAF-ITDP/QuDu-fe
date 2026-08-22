import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

import { TableColumn, TableComponent } from '../../../shared/components/table/table.component';

import { Branch } from '../../../models/master/branch.models';
import { Role } from '../../../models/master/role.models';
import { User, UserRequest } from '../../../models/master/user.models';

import { BranchService } from '../../../core/services/master/branch.services';
import { RolesService } from '../../../core/services/master/roles.services';
import { UserService } from '../../../core/services/master/user.services';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent],
  templateUrl: './user.component.html',
})
export class UserComponent implements OnInit {
  roles = signal<Role[]>([]);
  branches = signal<Branch[]>([]);
  users = signal<User[]>([]);

  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingUserId: number | null = null;

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
    },
    {
      key: 'fullName',
      label: 'Name',
      type: 'text',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
    },
    {
      key: 'roleName',
      label: 'Role',
      type: 'text',
    },
    {
      key: 'phoneNumber',
      label: 'Phone Number',
      type: 'text',
    },
    {
      key: 'branchName',
      label: 'Branch',
      type: 'text',
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
    this.loadUsers();
    this.loadRoles();
    this.loadBranches();
  }

  /**
   * GET ALL USERS
   */
  loadUsers(): void {
    this.loading.set(true);

    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.users.set(response.data ?? []);
        this.loading.set(false);
      },

      error: (error) => {
        console.error('Error loading users:', error);

        this.users.set([]);
        this.loading.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: error?.error?.message ?? 'Failed to load users.',
        });
      },
    });
  }

  /**
   * GET ALL ROLES
   */
  loadRoles(): void {
    this.roleService.getAllRoles().subscribe({
      next: (response) => {
        this.roles.set(response.data ?? []);
      },

      error: (error) => {
        console.error('Error loading roles:', error);
      },
    });
  }

  /**
   * GET ALL BRANCHES
   */
  loadBranches(): void {
    this.branchService.getAllBranches().subscribe({
      next: (response) => {
        this.branches.set(response.data ?? []);
      },

      error: (error) => {
        console.error('Error loading branches:', error);
      },
    });
  }

  /**
   * OPEN ADD USER MODAL
   */
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
    this.userForm.get('password')?.setValidators([Validators.required]);

    this.userForm.get('password')?.updateValueAndValidity();

    this.modalOpen.set(true);
  }

  /**
   * OPEN EDIT USER MODAL
   */
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

    // Password optional when editing
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();

    this.modalOpen.set(true);
  }

  /**
   * CLOSE MODAL
   */
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

  /**
   * CREATE / UPDATE USER
   */
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

    /**
     * Include password only if entered.
     */
    if (formValue.password) {
      request.password = formValue.password;
    }

    /**
     * UPDATE USER
     */
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

          this.loadUsers();
        },

        error: (error) => {
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

    /**
     * CREATE USER
     */
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

        this.loadUsers();
      },

      error: (error) => {
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

  /**
   * DELETE USER
   */
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

        error: (error) => {
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
