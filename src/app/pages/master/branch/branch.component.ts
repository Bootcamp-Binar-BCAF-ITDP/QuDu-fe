import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

import { TableColumn, TableComponent } from '../../../shared/components/table/table.component';

import { Branch } from '../../../models/master/branch.models';
import { BranchService } from '../../../core/services/master/branch.services';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-branch',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableComponent],
  templateUrl: './branch.component.html',
})
export class BranchComponent implements OnInit {
  branches = signal<Branch[]>([]);
  loading = signal(false);
  submitting = signal(false);

  modalOpen = signal(false);

  editingBranchId: number | null = null;

  columns: TableColumn[] = [
    {
      key: 'branchCode',
      label: 'Branch Code',
      type: 'text',
    },
    {
      key: 'branchName',
      label: 'Branch Name',
      type: 'text',
    },
    {
      key: 'location',
      label: 'Location',
      type: 'text',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
    },
    {
      key: 'phoneNumber',
      label: 'Phone Number',
      type: 'text',
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
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading.set(true);

    this.branchService.getAllBranches().subscribe({
      next: (response) => {
        const data = response?.data ?? response ?? [];

        this.branches.set(data);
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

  /**
   * Open modal for adding branch
   */
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

  /**
   * Open modal for editing branch
   */
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

  /**
   * Close modal
   */
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

  /**
   * Save / Update branch
   */
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

    /**
     * UPDATE
     */
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
            text: error?.error?.message ?? 'Failed to update branch.',
          });
        },
      });

      return;
    }

    /**
     * CREATE
     */
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

        this.loadBranches();
      },

      error: (error: HttpErrorResponse) => {
        console.error('Failed to create branch:', error);

        this.submitting.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Create Failed',
          text: error?.error?.message ?? 'Failed to create branch.',
        });
      },
    });
  }

  /**
   * Delete branch
   */
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
            text: error.error?.message ?? 'Failed to delete branch.',
          });
        },
      });
    });
  }
}
