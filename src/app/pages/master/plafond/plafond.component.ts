import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  SortEvent,
  TableColumn,
  TableComponent,
} from '../../../shared/components/table/table.component';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { Plafond, PlafondRequest } from '../../../models/master/plafond.models';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { PlafondService } from '../../../core/services/master/plafond.services';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-plafond',
  templateUrl: './plafond.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule],
})
export class PlafondComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  plafond = signal<Plafond[]>([]);
  totalElements = signal(0);

  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingPlafondId: number | null = null;

  // Search
  search = '';

  // Pagination
  currentPage = 1;
  pageSize = 5;

  // Sorting
  sortBy = 'plafondId';
  sortDir: 'asc' | 'desc' = 'asc';

  columns: TableColumn[] = [
    {
      key: 'plafondId',
      label: 'Plafond ID',
      type: 'text',
      sortable: true,
    },
    {
      key: 'level',
      label: 'Level',
      type: 'text',
      sortable: true,
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      sortable: false,
    },
    {
      key: 'minimumAmount',
      label: 'Min Amount',
      type: 'text',
      sortable: false,
    },
    {
      key: 'maxAmount',
      label: 'Max Amount',
      type: 'text',
      sortable: false,
    },
    {
      key: 'minTenor',
      label: 'Min Tenor',
      type: 'text',
      sortable: false,
    },
    {
      key: 'maxTenor',
      label: 'Max Tenor',
      type: 'text',
      sortable: false,
    },
    {
      key: 'interestRate',
      label: 'Interest Rate',
      type: 'text',
      sortable: true,
    },
    {
      key: 'adminFee',
      label: 'Admin Fee',
      type: 'text',
      sortable: true,
    },
  ];

  plafondForm;

  constructor(
    private formBuilder: FormBuilder,
    private plafondService: PlafondService,
  ) {
    this.plafondForm = this.formBuilder.group({
      level: [null as number | null, [Validators.required, Validators.min(1)]],
      description: ['', Validators.required],
      minimumAmount: [null as number | null, [Validators.required, Validators.min(0)]],
      maxAmount: [null as number | null, [Validators.required, Validators.min(0)]],
      minTenor: [null as number | null, [Validators.required, Validators.min(1)]],
      maxTenor: [null as number | null, [Validators.required, Validators.min(1)]],
      interestRate: [null as number | null, [Validators.required, Validators.min(0)]],
      adminFee: [null as number | null, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadPlafonds();
      });

    this.loadPlafonds();
  }

  // SEARCH HANDLER
  onSearch(): void {
    this.searchInput$.next(this.search);
  }

  // PAGE HANDLER
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadPlafonds();
  }

  // PAGE SIZE HANDLER
  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadPlafonds();
  }

  // SORT HANDLER
  onSortChange(event: SortEvent): void {
    this.sortBy = event.sortBy;
    this.sortDir = event.sortDir;
    this.currentPage = 1;
    this.loadPlafonds();
  }

  loadPlafonds(): void {
    this.loading.set(true);

    this.plafondService.getAllPlafonds({
        page: this.currentPage - 1,
        size: this.pageSize,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search.trim(),
      })
      .subscribe({
        next: (response) => {
          const page = response?.data;

          this.plafond.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);

          const lastPage = Math.max(1, page?.totalPages ?? 1);

          if (this.currentPage > lastPage) {
            this.currentPage = lastPage;
            this.loadPlafonds();
            return;
          }

          this.loading.set(false);
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to load plafond:', error);

          this.plafond.set([]);
          this.totalElements.set(0);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Failed to load plafond data.',
          });
        },
      });
  }

  addPlafond(): void {
    this.editingPlafondId = null;

    this.plafondForm.reset({
      level: null,
      description: '',
      minimumAmount: null,
      maxAmount: null,
      minTenor: null,
      maxTenor: null,
      interestRate: null,
      adminFee: null,
    });

    this.modalOpen.set(true);
  }

  editPlafond(plafond: Plafond): void {
    this.editingPlafondId = plafond.plafondId ?? null;

    this.plafondForm.patchValue({
      level: plafond.level,
      description: plafond.description,
      minimumAmount: plafond.minimumAmount,
      maxAmount: plafond.maxAmount,
      minTenor: plafond.minTenor,
      maxTenor: plafond.maxTenor,
      interestRate: plafond.interestRate,
      adminFee: plafond.adminFee,
    });

    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.submitting()) {
      return;
    }

    this.modalOpen.set(false);
    this.editingPlafondId = null;

    this.plafondForm.reset({
      level: null,
      description: '',
      minimumAmount: null,
      maxAmount: null,
      minTenor: null,
      maxTenor: null,
      interestRate: null,
      adminFee: null,
    });
  }

  savePlafond(): void {
    if (this.plafondForm.invalid) {
      this.plafondForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const formValue = this.plafondForm.getRawValue();

    const request: PlafondRequest = {
      level: Number(formValue.level ?? 0),
      description: formValue.description ?? '',
      minimumAmount: Number(formValue.minimumAmount ?? 0),
      maxAmount: Number(formValue.maxAmount ?? 0),
      minTenor: Number(formValue.minTenor ?? 0),
      maxTenor: Number(formValue.maxTenor ?? 0),
      interestRate: Number(formValue.interestRate ?? 0),
      adminFee: Number(formValue.adminFee ?? 0),
    };

    // UPDATE
    if (this.editingPlafondId !== null) {
      this.plafondService.updatePlafond(this.editingPlafondId, request).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();

          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Plafond updated successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          // Stay on the current page — the edited row is still there.
          this.loadPlafonds();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to update plafond:', error);

          this.submitting.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: error.error?.message ?? 'Failed to update plafond.',
          });
        },
      });

      return;
    }

    // CREATE
    this.plafondService.addPlafond(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();

        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: 'Plafond created successfully.',
          timer: 1500,
          showConfirmButton: false,
        });

        // Back to page 1 so the new record is visible.
        this.currentPage = 1;
        this.loadPlafonds();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create plafond:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: error.error?.message ?? 'Failed to create plafond.',
        });
      },
    });
  }

  deletePlafond(plafond: Plafond): void {
    const plafondId = plafond.plafondId;

    if (plafondId === undefined) {
      console.error('Plafond ID is missing.');
      return;
    }

    Swal.fire({
      title: 'Delete Plafond?',
      text: `Are you sure you want to delete "${plafond.description}"?`,
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

      this.plafondService.deletePlafond(plafondId).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Plafond deleted successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadPlafonds();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete plafond:', error);

          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: error.error?.message ?? 'Failed to delete plafond.',
          });
        },
      });
    });
  }
}
