import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

import { TableColumn, TableComponent } from '../../../shared/components/table/table.component';

import { Role, RoleRequest } from '../../../models/master/role.models';
import { HttpErrorResponse } from '@angular/common/http';
import { RolesService } from '../../../core/services/master/roles.services';
import { Menu } from '../../../models/master/menu.models';

@Component({
  selector: 'app-role',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule],
  templateUrl: './role.component.html',
})
export class RoleComponent implements OnInit {
  roles = signal<Role[]>([]);
  menus = signal<Menu[]>([]);

  loading = signal(false);
  submitting = signal(false);
  modalOpen = signal(false);

  editingRoleId: number | null = null;

  search = '';

  currentPage = 1;
  pageSize = 10;

  columns: TableColumn[] = [
    {
      key: 'roleId',
      label: 'Role ID',
      type: 'text',
    },
    {
      key: 'roleName',
      label: 'Role Name',
      type: 'text',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
    },
  ];

  roleForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly rolesService: RolesService,
  ) {
    this.roleForm = this.fb.group({
      roleName: ['', Validators.required],
      description: ['', Validators.required],
      menuIds: [[] as number[]],
    });
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadMenus();
  }

  // LOAD ROLES
  loadRoles(): void {
    this.loading.set(true);

    this.rolesService.getAllRoles().subscribe({
      next: (response) => {
        this.roles.set(response?.data ?? []);
        this.loading.set(false);
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to load roles:', error);

        this.loading.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: error.error?.message ?? 'Failed to load role data.',
        });
      },
    });
  }

  // LOAD MENUS
  loadMenus(): void {

    this.menus.set([
      {
        menuId: 1,
        menuName: 'Dashboard',
      },
      {
        menuId: 3,
        menuName: 'Menu1',
      },
      {
        menuId: 4,
        menuName: 'Menu2',
      },
      {
        menuId: 5,
        menuName: 'Menu3',
      },
      {
        menuId: 6,
        menuName: 'Menu4',
      },
      {
        menuId: 7,
        menuName: 'Menu5',
      },
    ]);
  }

  // SEARCH
  get filteredRoles(): Role[] {
    const keyword = this.search.trim().toLowerCase();

    if (!keyword) {
      return this.roles();
    }

    return this.roles().filter(
      (role) =>
        role.roleName.toLowerCase().includes(keyword) ||
        role.description.toLowerCase().includes(keyword),
    );
  }

  // PAGINATION
  get paginatedRoles(): Role[] {
    const start = (this.currentPage - 1) * this.pageSize;

    return this.filteredRoles.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRoles.length / this.pageSize);
  }

  // ADD ROLE
  addRole(): void {
    this.editingRoleId = null;

    this.roleForm.reset({
      roleName: '',
      description: '',
      menuIds: [],
    });

    this.modalOpen.set(true);
  }

  // EDIT ROLE
  editRole(role: Role): void {
    this.editingRoleId = role.roleId;

    const menuIds = role.menus.map((menu) => menu.menuId);

    this.roleForm.patchValue({
      roleName: role.roleName,
      description: role.description,
      menuIds,
    });

    this.modalOpen.set(true);
  }

  // CLOSE MODAL

  closeModal(): void {
    if (this.submitting()) {
      return;
    }

    this.modalOpen.set(false);
    this.editingRoleId = null;

    this.roleForm.reset({
      roleName: '',
      description: '',
      menuIds: [],
    });
  }

  // MENU CHECKBOX

  isMenuSelected(menuId: number): boolean {
    const selected = this.roleForm.get('menuIds')?.value ?? [];

    return selected.includes(menuId);
  }

  toggleMenu(menuId: number): void {
    const control = this.roleForm.get('menuIds');

    if (!control) {
      return;
    }

    const current = control.value ?? [];

    if (current.includes(menuId)) {
      control.setValue(current.filter((id) => id !== menuId));
    } else {
      control.setValue([...current, menuId]);
    }
  }

  // SAVE ROLE

  saveRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();

      return;
    }

    const formValue = this.roleForm.getRawValue();

    const menuIds = formValue.menuIds ?? [];

    if (menuIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Menu Required',
        text: 'Please select at least one menu.',
      });

      return;
    }

    const request: RoleRequest = {
      roleName: formValue.roleName ?? '',

      description: formValue.description ?? '',

      menuIds,
    };

    this.submitting.set(true);

    // ========================================
    // UPDATE
    // ========================================

    if (this.editingRoleId !== null) {
      this.rolesService.updateRole(this.editingRoleId, request).subscribe({
        next: () => {
          this.submitting.set(false);

          this.closeModal();

          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Role updated successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadRoles();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to update role:', error);

          this.submitting.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.error?.message ?? 'Failed to update role.',
          });
        },
      });

      return;
    }

    // ========================================
    // CREATE
    // ========================================

    this.rolesService.addRoles(request).subscribe({
      next: () => {
        this.submitting.set(false);

        this.closeModal();

        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: 'Role created successfully.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.loadRoles();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create role:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: error.error?.message ?? 'Failed to create role.',
        });
      },
    });
  }

  // DELETE ROLE

  deleteRole(role: Role): void {
    const roleId = role.roleId;

    Swal.fire({
      title: 'Delete Role?',

      text: `Are you sure you want to delete "${role.roleName}"?`,

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

      this.rolesService.deleteRole(roleId).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Role deleted successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadRoles();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete role:', error);

          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: error.error?.message ?? 'Failed to delete role.',
          });
        },
      });
    });
  }

  // PAGINATION

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
  }
}
