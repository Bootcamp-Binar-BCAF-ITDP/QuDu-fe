import { Component, signal } from '@angular/core';
import { TableColumn, TableComponent } from '../../../shared/components/table/table.component';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../../core/services/master/menu.services';
import Swal from 'sweetalert2';
import { Menu, MenuRequest } from '../../../models/master/menu.models';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent],
})
export class MenuComponent {
  menu = signal<Menu[]>([]);
  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingMenuId: number | null = null;

  columns: TableColumn[] = [
    {
      key: 'menuId',
      label: 'Menu ID',
      type: 'text',
    },
    {
      key: 'menuName',
      label: 'Menu Name',
      type: 'text',
    },
  ];

  menuForm;

  constructor(
    private formBuilder: FormBuilder,
    private menuService: MenuService,
  ) {
    this.menuForm = this.formBuilder.group({
      menuName: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadMenus();
  }

  loadMenus(): void {
    this.loading.set(true);

    this.menuService.getAllMenus().subscribe({
      next: (response) => {
        this.menu.set(response?.data ?? []);
        this.loading.set(false);
      },

      error: (error) => {
        console.error('Failed to load branches:', error);

        this.loading.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: 'Failed to load branch data.',
        });
      },
    });
  }

  addMenu(): void {
    this.editingMenuId = null;

    this.menuForm.reset({
      menuName: '',
    });

    this.modalOpen.set(true);
  }

  editMenu(menu: Menu): void {
    this.editingMenuId = menu.menuId ?? null;

    this.menuForm.patchValue({
      menuName: menu.menuName,
    });

    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.submitting()) {
      return;
    }

    this.modalOpen.set(false);
    this.editingMenuId = null;

    this.menuForm.reset({
      menuName: '',
    });
  }

  saveMenu(): void {
    if (this.menuForm.invalid) {
      this.menuForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const formValue = this.menuForm.getRawValue();

    const request: MenuRequest = {
      menuName: formValue.menuName ?? '',
    };

    // UPDATE
    if (this.editingMenuId !== null) {
      this.menuService.updateMenu(this.editingMenuId, request).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();

          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Menu updated successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadMenus();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to update menu:', error);

          this.submitting.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.error?.message ?? 'Failed to update menu.',
          });
        },
      });

      return;
    }

    // CREATE
    this.menuService.addMenu(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();

        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: 'Menu created successfully.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.loadMenus();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create menu:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: error.error?.message ?? 'Failed to create menu.',
        });
      },
    });
  }

  deleteMenu(menu: Menu): void {
    const menuId = menu.menuId;

    if (menuId === undefined) {
      console.error('Branch ID is missing.');
      return;
    }

    Swal.fire({
      title: 'Delete Branch?',
      text: `Are you sure you want to delete "${menu.menuName}"?`,
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

      this.menuService.deleteMenu(menuId).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Branch deleted successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadMenus();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete menu:', error);

          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: error.error?.message ?? 'Failed to delete menu.',
          });
        },
      });
    });
  }
}
