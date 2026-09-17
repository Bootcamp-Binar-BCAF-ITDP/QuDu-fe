import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject, throwError } from 'rxjs';

import { BranchService } from '../../../core/services/master/branch.services';

const swal = vi.hoisted(() => ({
  fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
}));

vi.mock('sweetalert2', () => ({ default: swal }));

const { BranchComponent } = await import('./branch.component');

const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({
  data: { content, totalElements, totalPages },
});

const row = {
  branchId: 5,
  branchCode: 'JKT-01',
  branchName: 'Jakarta Pusat',
  location: 'Jakarta',
  email: 'jkt@qudu.test',
  phoneNumber: '02100000',
  isActive: true,
};

describe('BranchComponent', () => {
  let component: InstanceType<typeof BranchComponent>;

  let listCalls: unknown[];
  let list$: Subject<any>;
  let writeCalls: { op: string; args: unknown[] }[];
  let write$: Subject<any>;
  let writeFails: unknown = null;
  let listFails: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    listCalls = [];
    list$ = new Subject<any>();
    writeCalls = [];
    write$ = new Subject<any>();
    writeFails = null;
    listFails = null;

    swal.fire.mockClear();
    swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: true }) as never);

    const record = (op: string) => (...args: unknown[]) => {
      writeCalls.push({ op, args });
      return writeFails ? throwError(() => writeFails) : write$.asObservable();
    };

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: BranchService,
          useValue: {
            getAllBranches: (params: unknown) => {
              listCalls.push(params);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
            addBranch: record('add'),
            updateBranch: record('update'),
            deleteBranch: record('delete'),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new BranchComponent(TestBed.inject(FormBuilder), TestBed.inject(BranchService)),
    );
  };

  beforeEach(() => build());

  describe('loading', () => {
    it('asks for the first page sorted by branchId', () => {
      component.ngOnInit();

      expect(listCalls[0]).toMatchObject({ page: 0, sortBy: 'branchId', sortDir: 'asc' });
    });

    it('fills the table from the page', () => {
      component.loadBranches();
      list$.next(page([row], 9));

      expect(component.branches()).toHaveLength(1);
      expect(component.totalElements()).toBe(9);
      expect(component.loading()).toBe(false);
    });

    it('empties the table and reports a failure', () => {
      listFails = new HttpErrorResponse({ status: 500 });
      component.loadBranches();

      expect(component.branches()).toEqual([]);
      expect(swal.fire).toHaveBeenCalled();
    });
  });

  describe('the form', () => {
    it('requires the code and the name', () => {
      component.addBranch();
      expect(component.branchForm.invalid).toBe(true);

      component.branchForm.patchValue({ branchCode: 'JKT-01', branchName: 'Jakarta Pusat' });
      expect(component.branchForm.valid).toBe(true);
    });

    it('leaves location and phone optional, since not every branch has them recorded', () => {
      component.branchForm.patchValue({
        branchCode: 'JKT-01',
        branchName: 'Jakarta',
        location: '',
        phoneNumber: '',
      });

      expect(component.branchForm.valid).toBe(true);
    });

    it('accepts an empty email but rejects a malformed one', () => {
      component.branchForm.patchValue({ branchCode: 'A', branchName: 'B', email: '' });
      expect(component.branchForm.valid).toBe(true);

      component.branchForm.patchValue({ email: 'not-an-email' });
      expect(component.branchForm.invalid).toBe(true);
    });

    it('defaults a new branch to active', () => {
      component.addBranch();
      expect(component.branchForm.value.isActive).toBe(true);
    });
  });

  describe('the editor modal', () => {
    it('opens empty for a new branch', () => {
      component.addBranch();

      expect(component.modalOpen()).toBe(true);
      expect(component.editingBranchId).toBeNull();
      expect(component.branchForm.value.branchCode).toBe('');
    });

    it('opens filled for an existing branch', () => {
      component.editBranch(row);

      expect(component.editingBranchId).toBe(5);
      expect(component.branchForm.value.branchName).toBe('Jakarta Pusat');
    });

    it('refuses to close while a save is in flight', () => {
      component.addBranch();
      component.submitting.set(true);
      component.closeModal();

      expect(component.modalOpen()).toBe(true);
    });
  });

  describe('saving', () => {
    const fillValid = () =>
      component.branchForm.patchValue({ branchCode: 'JKT-01', branchName: 'Jakarta Pusat' });

    it('sends nothing while the form is invalid', () => {
      component.addBranch();
      component.saveBranch();

      expect(writeCalls).toEqual([]);
      expect(component.branchForm.get('branchCode')?.touched).toBe(true);
    });

    it('creates when nothing was being edited', () => {
      component.addBranch();
      fillValid();
      component.saveBranch();

      expect(writeCalls[0].op).toBe('add');
    });

    it('updates with the row id when one was being edited', () => {
      component.editBranch(row);
      component.saveBranch();

      expect(writeCalls[0].op).toBe('update');
      expect(writeCalls[0].args[0]).toBe(5);
    });

    it('fills the optional fields with empty strings rather than sending undefined', () => {
      component.addBranch();
      fillValid();
      component.saveBranch();

      expect(writeCalls[0].args[0]).toMatchObject({
        location: '',
        email: '',
        phoneNumber: '',
        isActive: true,
      });
    });

    it('keeps the modal open when the save fails', () => {
      writeFails = new HttpErrorResponse({ status: 400, error: { message: 'Code in use.' } });
      component.addBranch();
      fillValid();
      component.saveBranch();

      expect(component.modalOpen()).toBe(true);
      expect(component.submitting()).toBe(false);
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes', async () => {
      component.deleteBranch(row);
      await Promise.resolve();

      expect(swal.fire).toHaveBeenCalled();
      expect(writeCalls[0].op).toBe('delete');
      expect(writeCalls[0].args[0]).toBe(5);
    });

    it('does nothing when the confirmation is declined', async () => {
      swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: false }) as never);

      component.deleteBranch(row);
      await Promise.resolve();

      expect(writeCalls).toEqual([]);
    });
  });
});
