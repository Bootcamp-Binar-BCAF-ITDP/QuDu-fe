import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject, throwError } from 'rxjs';

import { PlafondService } from '../../../core/services/master/plafond.services';

const swal = vi.hoisted(() => ({
  fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
}));

vi.mock('sweetalert2', () => ({ default: swal }));

const { PlafondComponent } = await import('./plafond.component');

const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({
  data: { content, totalElements, totalPages },
});

const row = {
  plafondId: 4,
  level: 2,
  description: 'Silver',
  minimumAmount: 5_000_000,
  maxAmount: 50_000_000,
  minTenor: 6,
  maxTenor: 36,
  interestRate: 12,
  adminFee: 250_000,
};

const validForm = {
  level: 2,
  description: 'Silver',
  minimumAmount: 5_000_000,
  maxAmount: 50_000_000,
  minTenor: 6,
  maxTenor: 36,
  interestRate: 12,
  adminFee: 250_000,
};

describe('PlafondComponent', () => {
  let component: InstanceType<typeof PlafondComponent>;

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
          provide: PlafondService,
          useValue: {
            getAllPlafonds: (params: unknown) => {
              listCalls.push(params);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
            addPlafond: record('add'),
            updatePlafond: record('update'),
            deletePlafond: record('delete'),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new PlafondComponent(TestBed.inject(FormBuilder), TestBed.inject(PlafondService)),
    );
  };

  beforeEach(() => build());

  describe('loading', () => {
    it('asks for the first page sorted by plafondId', () => {
      component.ngOnInit();
      expect(listCalls[0]).toMatchObject({ page: 0, sortBy: 'plafondId', sortDir: 'asc' });
    });

    it('fills the table from the page', () => {
      component.loadPlafonds();
      list$.next(page([row], 3));

      expect(component.plafond()).toHaveLength(1);
      expect(component.totalElements()).toBe(3);
    });

    it('empties the table and reports a failure', () => {
      listFails = new HttpErrorResponse({ status: 500 });
      component.loadPlafonds();

      expect(component.plafond()).toEqual([]);
      expect(swal.fire).toHaveBeenCalled();
    });
  });

  describe('the form', () => {
    it('starts with every field empty and invalid', () => {
      component.addPlafond();
      expect(component.plafondForm.invalid).toBe(true);
    });

    it('requires all eight fields', () => {
      for (const field of Object.keys(validForm)) {
        component.plafondForm.setValue({
          ...validForm,
          [field]: field === 'description' ? '' : null,
        } as never);

        expect(component.plafondForm.invalid, `${field} is not required`).toBe(true);
      }
    });

    it('refuses a level below one, since tiers start at one', () => {
      component.plafondForm.setValue({ ...validForm, level: 0 } as never);
      expect(component.plafondForm.invalid).toBe(true);
    });

    it('refuses a negative amount', () => {
      component.plafondForm.setValue({ ...validForm, minimumAmount: -1 } as never);
      expect(component.plafondForm.invalid).toBe(true);
    });

    it('allows a zero amount and a zero rate, which a promotional tier may use', () => {
      component.plafondForm.setValue({
        ...validForm,
        minimumAmount: 0,
        interestRate: 0,
        adminFee: 0,
      } as never);

      expect(component.plafondForm.valid).toBe(true);
    });

    it('refuses a tenor below one month', () => {
      component.plafondForm.setValue({ ...validForm, minTenor: 0 } as never);
      expect(component.plafondForm.invalid).toBe(true);
    });

    it('accepts a fully filled tier', () => {
      component.plafondForm.setValue(validForm as never);
      expect(component.plafondForm.valid).toBe(true);
    });
  });

  describe('the editor modal', () => {
    it('opens empty for a new tier', () => {
      component.addPlafond();

      expect(component.modalOpen()).toBe(true);
      expect(component.editingPlafondId).toBeNull();
    });

    it('opens filled for an existing tier', () => {
      component.editPlafond(row);

      expect(component.editingPlafondId).toBe(4);
      expect(component.plafondForm.value.description).toBe('Silver');
    });

    it('refuses to close while a save is in flight', () => {
      component.addPlafond();
      component.submitting.set(true);
      component.closeModal();

      expect(component.modalOpen()).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends nothing while the form is invalid', () => {
      component.addPlafond();
      component.savePlafond();

      expect(writeCalls).toEqual([]);
    });

    it('creates when nothing was being edited', () => {
      component.addPlafond();
      component.plafondForm.setValue(validForm as never);
      component.savePlafond();

      expect(writeCalls[0].op).toBe('add');
    });

    it('updates with the tier id when one was being edited', () => {
      component.editPlafond(row);
      component.savePlafond();

      expect(writeCalls[0].op).toBe('update');
      expect(writeCalls[0].args[0]).toBe(4);
    });

    it('sends every money and rate field as a number, since the inputs yield strings', () => {
      component.addPlafond();
      component.plafondForm.setValue({
        level: '2',
        description: 'Silver',
        minimumAmount: '5000000',
        maxAmount: '50000000',
        minTenor: '6',
        maxTenor: '36',
        interestRate: '12',
        adminFee: '250000',
      } as never);

      component.savePlafond();

      const body = writeCalls[0].args[0] as Record<string, unknown>;
      for (const [field, value] of Object.entries(body)) {
        if (field === 'description') continue;
        expect(typeof value, field).toBe('number');
      }
      expect(body['minimumAmount']).toBe(5_000_000);
    });

    it('keeps the modal open when the save fails', () => {
      writeFails = new HttpErrorResponse({ status: 400 });
      component.addPlafond();
      component.plafondForm.setValue(validForm as never);
      component.savePlafond();

      expect(component.modalOpen()).toBe(true);
      expect(component.submitting()).toBe(false);
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes by id', async () => {
      component.deletePlafond(row);
      await Promise.resolve();

      expect(writeCalls[0].op).toBe('delete');
      expect(writeCalls[0].args[0]).toBe(4);
    });

    it('does nothing when the confirmation is declined', async () => {
      swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: false }) as never);

      component.deletePlafond(row);
      await Promise.resolve();

      expect(writeCalls).toEqual([]);
    });
  });
});
