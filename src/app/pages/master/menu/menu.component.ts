import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import {
  SortEvent,
  TableColumn,
  TableComponent,
} from '../../../shared/components/table/table.component';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../../core/services/master/menu.services';
import Swal from 'sweetalert2';
import { Menu, MenuRequest } from '../../../models/master/menu.models';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../shared/utils/api-message.util';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule],
})
export class MenuComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  menu = signal<Menu[]>([]);
  totalElements = signal(0);

  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingMenuId: number | null = null;

  search = '';

  currentPage = 1;
  pageSize = 5;

  sortBy = 'menuId';
  sortDir: 'asc' | 'desc' = 'asc';

  columns: TableColumn[] = [
    {
      key: 'menuId',
      label: 'Menu ID',
      type: 'text',
      sortable: true,
    },
    {
      key: 'menuName',
      label: 'Menu Name',
      type: 'text',
      sortable: true,
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
    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadMenus();
      });

    this.loadMenus();
  }

  onSearch(): void {
    this.searchInput$.next(this.search);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMenus();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadMenus();
  }

  onSortChange(event: SortEvent): void {
    this.sortBy = event.sortBy;
    this.sortDir = event.sortDir;
    this.currentPage = 1;
    this.loadMenus();
  }

  loadMenus(): void {
    this.loading.set(true);

    this.menuService
      .getAllMenus({
        page: this.currentPage - 1,
        size: this.pageSize,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search.trim(),
      })
      .subscribe({
        next: (response) => {
          const page = response?.data;

          this.menu.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);

          const lastPage = Math.max(1, page?.totalPages ?? 1);

          if (this.currentPage > lastPage) {
            this.currentPage = lastPage;
            this.loadMenus();
            return;
          }

          this.loading.set(false);
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to load menu:', error);

          this.menu.set([]);
          this.totalElements.set(0);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Failed to load menu data.',
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
            text: apiErrorMessage(error, 'Failed to update menu.'),
          });
        },
      });

      return;
    }

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

        this.currentPage = 1;
        this.loadMenus();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create menu:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: apiErrorMessage(error, 'Failed to create menu.'),
        });
      },
    });
  }

  deleteMenu(menu: Menu): void {
    const menuId = menu.menuId;

    if (menuId === undefined) {
      console.error('Menu ID is missing.');
      return;
    }

    Swal.fire({
      title: 'Delete Menu?',
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
            text: 'Menu deleted successfully.',
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
            text: apiErrorMessage(error, 'Failed to delete menu.'),
          });
        },
      });
    });
  }
}
