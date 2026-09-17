import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject, throwError } from 'rxjs';

import { BranchService } from '../../../core/services/master/branch.services';
import { RolesService } from '../../../core/services/master/roles.services';
import { UserService } from '../../../core/services/master/user.services';

const swal = vi.hoisted(() => ({
  fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
}));

vi.mock('sweetalert2', () => ({ default: swal }));

const { UserComponent } = await import('./user.component');

const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({
  data: { content, totalElements, totalPages },
});

const row = {
  userId: 'U-9',
  username: 'budi',
  email: 'budi@qudu.test',
  fullName: 'Budi Santoso',
  phoneNumber: '08120000000',
  roleId: 2,
  branchId: 3,
};

describe('UserComponent', () => {
  let component: InstanceType<typeof UserComponent>;

  let listCalls: unknown[];
  let list$: Subject<any>;
  let roles$: Subject<any>;
  let branches$: Subject<any>;
  let writeCalls: { op: string; args: unknown[] }[];
  let write$: Subject<any>;
  let writeFails: unknown = null;
  let listFails: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    listCalls = [];
    list$ = new Subject<any>();
    roles$ = new Subject<any>();
    branches$ = new Subject<any>();
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
          provide: UserService,
          useValue: {
            getAllUsers: (params: unknown) => {
              listCalls.push(params);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
            createUser: record('create'),
            updateUser: record('update'),
            deleteUser: record('delete'),
          },
        },
        { provide: RolesService, useValue: { getRoleOptions: () => roles$.asObservable() } },
        { provide: BranchService, useValue: { getAllBranches: () => branches$.asObservable() } },
      ],
    });

    component = TestBed.runInInjectionContext(
      () =>
        new UserComponent(
          TestBed.inject(FormBuilder),
          TestBed.inject(BranchService),
          TestBed.inject(RolesService),
          TestBed.inject(UserService),
        ),
    );
  };

  const fillValid = () =>
    component.userForm.patchValue({
      username: 'budi',
      email: 'budi@qudu.test',
      password: 'secret',
      fullName: 'Budi Santoso',
      phoneNumber: '08120000000',
      roleId: 2,
      branchId: 3,
    });

  beforeEach(() => build());

  describe('loading', () => {
    it('sorts by username, since a user has no numeric id', () => {
      component.ngOnInit();
      expect(listCalls[0]).toMatchObject({ page: 0, sortBy: 'username', sortDir: 'asc' });
    });

    it('loads the role and branch dropdowns as well as the list', () => {
      component.ngOnInit();

      roles$.next({ data: [{ roleId: 1, roleName: 'MARKETING' }] });
      branches$.next({ data: { content: [{ branchId: 1, branchName: 'Jakarta' }] } });

      expect(component.roles()).toHaveLength(1);
      expect(component.branches()).toHaveLength(1);
    });

    it('reads branches out of a page, unlike roles which come as a plain list', () => {
      component.loadBranches();
      branches$.next({ data: { content: [] } });

      expect(component.branches()).toEqual([]);
    });

    it('treats missing dropdown data as empty', () => {
      component.loadRoles();
      component.loadBranches();

      roles$.next({});
      branches$.next({});

      expect(component.roles()).toEqual([]);
      expect(component.branches()).toEqual([]);
    });

    it('fills the table from the page', () => {
      component.loadUsers();
      list$.next(page([row], 4));

      expect(component.users()).toHaveLength(1);
      expect(component.totalElements()).toBe(4);
    });

    it('empties the table and reports a list failure', () => {
      listFails = new HttpErrorResponse({ status: 500 });
      component.loadUsers();

      expect(component.users()).toEqual([]);
      expect(swal.fire).toHaveBeenCalled();
    });
  });

  describe('the password rule', () => {
    it('requires a password when creating, because there is none yet', () => {
      component.addUser();
      component.userForm.patchValue({
        username: 'budi',
        email: 'budi@qudu.test',
        fullName: 'Budi',
        phoneNumber: '081',
        roleId: 2,
        branchId: 3,
        password: '',
      });

      expect(component.userForm.invalid).toBe(true);
    });

    it('does not require one when editing, so an unchanged password can be left alone', () => {
      component.editUser(row);
      component.userForm.patchValue({ password: '' });

      expect(component.userForm.valid).toBe(true);
    });

    it('requires one again when the modal switches back to creating', () => {
      component.editUser(row);
      component.addUser();

      component.userForm.patchValue({
        username: 'budi',
        email: 'budi@qudu.test',
        fullName: 'Budi',
        phoneNumber: '081',
        roleId: 2,
        branchId: 3,
        password: '',
      });

      expect(component.userForm.invalid).toBe(true);
    });

    it('never prefills the existing password into the field', () => {
      component.editUser(row);
      expect(component.userForm.value.password).toBe('');
    });
  });

  describe('the form', () => {
    it('rejects a malformed email', () => {
      fillValid();
      component.userForm.patchValue({ email: 'not-an-email' });

      expect(component.userForm.invalid).toBe(true);
    });

    it('requires a role and a branch', () => {
      fillValid();
      component.userForm.patchValue({ roleId: null });
      expect(component.userForm.invalid).toBe(true);

      component.userForm.patchValue({ roleId: 2, branchId: null });
      expect(component.userForm.invalid).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends nothing while the form is invalid', () => {
      component.addUser();
      component.saveUser();

      expect(writeCalls).toEqual([]);
    });

    it('creates through the register endpoint when nothing was being edited', () => {
      component.addUser();
      fillValid();
      component.saveUser();

      expect(writeCalls[0].op).toBe('create');
    });

    it('updates with the string user id when one was being edited', () => {
      component.editUser(row);
      component.userForm.patchValue({ fullName: 'Budi S' });
      component.saveUser();

      expect(writeCalls[0].op).toBe('update');
      expect(writeCalls[0].args[0]).toBe('U-9');
    });

    it('sends the staff account type', () => {
      component.addUser();
      fillValid();
      component.saveUser();

      expect(writeCalls[0].args[0]).toMatchObject({ accountType: 'USER' });
    });

    it('converts the role and branch selects to numbers', () => {
      component.addUser();
      fillValid();
      component.userForm.patchValue({ roleId: '2' as never, branchId: '3' as never });
      component.saveUser();

      const body = writeCalls[0].args[0] as { roleId: unknown; branchId: unknown };
      expect(body.roleId).toBe(2);
      expect(body.branchId).toBe(3);
    });

    it('omits the password entirely when the field was left blank on an edit', () => {
      component.editUser(row);
      component.saveUser();

      expect(writeCalls[0].args[1]).not.toHaveProperty('password');
    });

    it('includes the password when one was typed', () => {
      component.editUser(row);
      component.userForm.patchValue({ password: 'newsecret' });
      component.saveUser();

      expect(writeCalls[0].args[1]).toMatchObject({ password: 'newsecret' });
    });

    it('keeps the modal open when the save fails', () => {
      writeFails = new HttpErrorResponse({ status: 400 });
      component.addUser();
      fillValid();
      component.saveUser();

      expect(component.modalOpen()).toBe(true);
      expect(component.submitting()).toBe(false);
    });
  });

  describe('the editor modal', () => {
    it('refuses to close while a save is in flight', () => {
      component.addUser();
      component.submitting.set(true);
      component.closeModal();

      expect(component.modalOpen()).toBe(true);
    });

    it('forgets who was being edited when closed', () => {
      component.editUser(row);
      component.closeModal();

      expect(component.editingUserId).toBeNull();
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes by id', async () => {
      component.deleteUser(row);
      await Promise.resolve();

      expect(writeCalls[0].op).toBe('delete');
      expect(writeCalls[0].args[0]).toBe('U-9');
    });

    it('does nothing when the confirmation is declined', async () => {
      swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: false }) as never);

      component.deleteUser(row);
      await Promise.resolve();

      expect(writeCalls).toEqual([]);
    });
  });
});
