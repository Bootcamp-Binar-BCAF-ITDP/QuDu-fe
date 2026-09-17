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

import { Branch } from '../../../models/master/branch.models';
import { BranchService } from '../../../core/services/master/branch.services';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../shared/utils/api-message.util';

@Component({
  selector: 'app-branch',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent, FormsModule],
  templateUrl: './branch.component.html',
})
export class BranchComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  branches = signal<Branch[]>([]);
  totalElements = signal(0);

  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingBranchId: number | null = null;

  search = '';

  currentPage = 1;
  pageSize = 5;

  sortBy = 'branchId';
  sortDir: 'asc' | 'desc' = 'asc';

  columns: TableColumn[] = [
    {
      key: 'branchCode',
      label: 'Branch Code',
      type: 'text',
      sortable: true,
    },
    {
      key: 'branchName',
      label: 'Branch Name',
      type: 'text',
      sortable: true,
    },
    {
      key: 'location',
      label: 'Location',
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
      key: 'phoneNumber',
      label: 'Phone Number',
      type: 'text',
      sortable: true,
    },
    {
      key: 'isActive',
      label: 'Status',
      type: 'status',
    },
  ];

  branchForm;

  constructor(
    private fb: FormBuilder,
    private branchService: BranchService,
  ) {
    this.branchForm = this.fb.group({
      branchCode: ['', Validators.required],
      branchName: ['', Validators.required],
      location: [''],
      email: ['', [Validators.email]],
      phoneNumber: [''],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadBranches();
      });

    this.loadBranches();
  }

  onSearch(): void {
    this.searchInput$.next(this.search);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBranches();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadBranches();
  }

  onSortChange(event: SortEvent): void {
    this.sortBy = event.sortBy;
    this.sortDir = event.sortDir;
    this.currentPage = 1;
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading.set(true);

    this.branchService
      .getAllBranches({
        page: this.currentPage - 1,
        size: this.pageSize,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search.trim(),
      })
      .subscribe({
        next: (response) => {
          const page = response?.data;

          this.branches.set(page?.content ?? []);
          this.totalElements.set(page?.totalElements ?? 0);

          const lastPage = Math.max(1, page?.totalPages ?? 1);

          if (this.currentPage > lastPage) {
            this.currentPage = lastPage;
            this.loadBranches();
            return;
          }

          this.loading.set(false);
        },

        error: (error) => {
          console.error('Failed to load branches:', error);

          this.branches.set([]);
          this.totalElements.set(0);
          this.loading.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Failed to load branch data.',
          });
        },
      });
  }

  addBranch(): void {
    this.editingBranchId = null;

    this.branchForm.reset({
      branchCode: '',
      branchName: '',
      location: '',
      email: '',
      phoneNumber: '',
      isActive: true,
    });

    this.modalOpen.set(true);
  }

  editBranch(branch: Branch): void {
    this.editingBranchId = branch.branchId ?? null;

    this.branchForm.patchValue({
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      location: branch.location ?? '',
      email: branch.email ?? '',
      phoneNumber: branch.phoneNumber ?? '',
      isActive: branch.isActive,
    });

    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.submitting()) {
      return;
    }

    this.modalOpen.set(false);
    this.editingBranchId = null;

    this.branchForm.reset({
      branchCode: '',
      branchName: '',
      location: '',
      email: '',
      phoneNumber: '',
      isActive: true,
    });
  }

  saveBranch(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const formValue = this.branchForm.getRawValue();

    const branch: Branch = {
      branchCode: formValue.branchCode ?? '',
      branchName: formValue.branchName ?? '',
      location: formValue.location ?? '',
      email: formValue.email ?? '',
      phoneNumber: formValue.phoneNumber ?? '',
      isActive: formValue.isActive ?? true,
    };

    if (this.editingBranchId !== null) {
      this.branchService.updateBranch(this.editingBranchId, branch).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();

          Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Branch updated successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadBranches();
        },

        error: (error) => {
          console.error('Failed to update branch:', error);

          this.submitting.set(false);

          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: apiErrorMessage(error, 'Failed to update branch.'),
          });
        },
      });

      return;
    }


    this.branchService.addBranch(branch).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();

        Swal.fire({
          icon: 'success',
          title: 'Created',
          text: 'Branch created successfully.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.currentPage = 1;
        this.loadBranches();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create branch:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: apiErrorMessage(error, 'Failed to create branch.'),
        });
      },
    });
  }

  deleteBranch(branch: Branch): void {
    const branchId = branch.branchId;

    if (branchId === undefined) {
      console.error('Branch ID is missing.');
      return;
    }

    Swal.fire({
      title: 'Delete Branch?',
      text: `Are you sure you want to delete "${branch.branchName}"?`,
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

      this.branchService.deleteBranch(branchId).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Branch deleted successfully.',
            timer: 1500,
            showConfirmButton: false,
          });

          this.loadBranches();
        },

        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete branch:', error);

          Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: apiErrorMessage(error, 'Failed to delete branch.'),
          });
        },
      });
    });
  }
}
