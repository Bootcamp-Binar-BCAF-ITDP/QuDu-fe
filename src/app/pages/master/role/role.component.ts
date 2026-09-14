import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import Swal from 'sweetalert2';

import {
  SortEvent,
  TableColumn,
  TableComponent,
} from '../../../shared/components/table/table.component';

import { Role, RoleRequest } from '../../../models/master/role.models';
import { HttpErrorResponse } from '@angular/common/http';
import { RolesService } from '../../../core/services/master/roles.services';
import { Menu } from '../../../models/master/menu.models';
import { MenuService } from '../../../core/services/master/menu.services';
import { Router } from '@angular/router';

@Component({
  selector: 'app-role',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule],
  templateUrl: './role.component.html',
})
export class RoleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();
  router = inject(Router);

  roles = signal<Role[]>([]);
  totalElements = signal(0);

  menus = signal<Menu[]>([]);

  loading = signal(false);
  submitting = signal(false);
  modalOpen = signal(false);

  editingRoleId: number | null = null;

  search = '';

  currentPage = 1;
  pageSize = 5;

  sortBy = 'roleId';
  sortDir: 'asc' | 'desc' = 'asc';

  columns: TableColumn[] = [
    {
      key: 'roleId',
      label: 'Role ID',
      type: 'text',
      sortable: true,
    },
    {
      key: 'roleName',
      label: 'Role Name',
      type: 'text',
      sortable: true,
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      sortable: true,
    },
  ];

  roleForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly rolesService: RolesService,
    private readonly menuService: MenuService,
  ) {
    this.roleForm = this.fb.group({
      roleName: ['', Validators.required],
      description: ['', Validators.required],
      menuIds: [[] as number[]],
    });
  }

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadRoles();
      });

    this.loadRoles();
    this.loadMenus();
  }

  onSearch(): void {
    this.searchInput$.next(this.search);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadRoles();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadRoles();
  }

  onSortChange(event: SortEvent): void {
    this.sortBy = event.sortBy;
    this.sortDir = event.sortDir;
    this.currentPage = 1;
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);

    this.rolesService
      .getAllRoles({
        page: this.currentPage - 1,
        size: this.pageSize,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search.trim(),
      })
      .subscribe({
        next: (response) => {
          const page = response?.data;

          this.roles.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);

          const lastPage = Math.max(1, page?.totalPages ?? 1);

          if (this.currentPage > lastPage) {
            this.currentPage = lastPage;
            this.loadRoles();
            return;
          }

          this.loading.set(false);
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to load roles:', error);

          this.roles.set([]);
          this.totalElements.set(0);
          this.loading.set(false);
        },
      });
  }

  loadMenus(): void {
    this.menuService.getMenuOptions().subscribe({
      next: (response) => {
        this.menus.set(response?.data ?? []);
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to load menu:', error);

      },
    });
  }

  addRole(): void {
    this.editingRoleId = null;

    this.roleForm.reset({
      roleName: '',
      description: '',
      menuIds: [],
    });

    this.modalOpen.set(true);
  }

  editRole(role: Role): void {
    this.editingRoleId = role.roleId;

    const menuIds = (role.menus ?? []).map((menu) => menu.menuId);

    this.roleForm.patchValue({
      roleName: role.roleName,
      description: role.description,
      menuIds,
    });

    this.modalOpen.set(true);
  }

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
      roleName: formValue.roleName?.toUpperCase() ?? '',

      description: formValue.description ?? '',

      menuIds,
    };

    this.submitting.set(true);

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

        this.currentPage = 1;
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


  deleteRole(role: Role): void {
    const roleId = role.roleId;

    if (roleId === undefined || roleId === null) {
      console.error('Role ID is missing.');
      return;
    }

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
}
