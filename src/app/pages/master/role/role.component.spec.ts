import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { MenuService } from '../../../core/services/master/menu.services';
import { RolesService } from '../../../core/services/master/roles.services';

const swal = vi.hoisted(() => ({
  fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
}));

vi.mock('sweetalert2', () => ({ default: swal }));

const { RoleComponent } = await import('./role.component');

const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({
  data: { content, totalElements, totalPages },
});

const menus = [
  { menuId: 1, menuName: 'Dashboard' },
  { menuId: 2, menuName: 'Applications' },
  { menuId: 3, menuName: 'Bucket' },
];

const row = {
  roleId: 6,
  roleName: 'MARKETING',
  description: 'Front line',
  menus: [menus[0], menus[2]],
};

describe('RoleComponent', () => {
  let component: InstanceType<typeof RoleComponent>;

  let listCalls: unknown[];
  let list$: Subject<any>;
  let menus$: Subject<any>;
  let writeCalls: { op: string; args: unknown[] }[];
  let write$: Subject<any>;
  let writeFails: unknown = null;
  let listFails: unknown = null;
  let menusFail: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    listCalls = [];
    list$ = new Subject<any>();
    menus$ = new Subject<any>();
    writeCalls = [];
    write$ = new Subject<any>();
    writeFails = null;
    listFails = null;
    menusFail = null;

    swal.fire.mockClear();
    swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: true }) as never);

    const record = (op: string) => (...args: unknown[]) => {
      writeCalls.push({ op, args });
      return writeFails ? throwError(() => writeFails) : write$.asObservable();
    };

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: Router, useValue: { navigate: () => undefined } },
        {
          provide: RolesService,
          useValue: {
            getAllRoles: (params: unknown) => {
              listCalls.push(params);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
            addRoles: record('add'),
            updateRole: record('update'),
            deleteRole: record('delete'),
          },
        },
        {
          provide: MenuService,
          useValue: {
            getMenuOptions: () =>
              menusFail ? throwError(() => menusFail) : menus$.asObservable(),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () =>
        new RoleComponent(
          TestBed.inject(FormBuilder),
          TestBed.inject(RolesService),
          TestBed.inject(MenuService),
        ),
    );
  };

  const fillValid = () =>
    component.roleForm.patchValue({ roleName: 'MARKETING', description: 'Front line' });

  beforeEach(() => build());

  describe('loading', () => {
    it('asks for the first page sorted by roleId', () => {
      component.ngOnInit();
      expect(listCalls[0]).toMatchObject({ page: 0, sortBy: 'roleId', sortDir: 'asc' });
    });

    it('loads the menu checkboxes as well as the role list', () => {
      component.ngOnInit();
      menus$.next({ data: menus });

      expect(component.menus()).toHaveLength(3);
    });

    it('treats a missing menu list as empty rather than crashing the checkboxes', () => {
      component.loadMenus();
      menus$.next({});

      expect(component.menus()).toEqual([]);
    });

    it('leaves the checkboxes empty and stays quiet when the menu list fails', () => {
      menusFail = new HttpErrorResponse({ status: 403 });
      component.loadMenus();

      expect(component.menus()).toEqual([]);
      expect(swal.fire).not.toHaveBeenCalled();
    });

    it('empties the table when the list fails', () => {
      listFails = new HttpErrorResponse({ status: 500 });
      component.loadRoles();

      expect(component.roles()).toEqual([]);
      expect(component.totalElements()).toBe(0);
      expect(component.loading()).toBe(false);
    });

    it('says nothing to the user about that failure, unlike every other master page', () => {
      listFails = new HttpErrorResponse({ status: 500 });
      component.loadRoles();

      expect(swal.fire).not.toHaveBeenCalled();
    });
  });

  describe('choosing menus', () => {
    it('starts with none selected for a new role', () => {
      component.addRole();

      expect(component.isMenuSelected(1)).toBe(false);
      expect(component.roleForm.value.menuIds).toEqual([]);
    });

    it('selects the menus the role already has when editing', () => {
      component.editRole(row);

      expect(component.isMenuSelected(1)).toBe(true);
      expect(component.isMenuSelected(3)).toBe(true);
      expect(component.isMenuSelected(2)).toBe(false);
    });

    it('adds a menu on first click', () => {
      component.addRole();
      component.toggleMenu(2);

      expect(component.isMenuSelected(2)).toBe(true);
    });

    it('removes it on a second click', () => {
      component.addRole();
      component.toggleMenu(2);
      component.toggleMenu(2);

      expect(component.isMenuSelected(2)).toBe(false);
      expect(component.roleForm.value.menuIds).toEqual([]);
    });

    it('keeps the other selections when one is removed', () => {
      component.addRole();
      component.toggleMenu(1);
      component.toggleMenu(2);
      component.toggleMenu(1);

      expect(component.roleForm.value.menuIds).toEqual([2]);
    });

    it('survives a role that carries no menus at all', () => {
      component.editRole({ ...row, menus: [] });

      expect(component.roleForm.value.menuIds).toEqual([]);
    });
  });

  describe('saving', () => {
    it('sends nothing while the name or description is missing', () => {
      component.addRole();
      component.saveRole();

      expect(writeCalls).toEqual([]);
      expect(component.roleForm.get('roleName')?.touched).toBe(true);
    });

    it('refuses a role with no menu, because it would see nothing after signing in', () => {
      component.addRole();
      fillValid();
      component.saveRole();

      expect(writeCalls).toEqual([]);
      expect(swal.fire).toHaveBeenCalled();
    });

    it('creates once at least one menu is chosen', () => {
      component.addRole();
      fillValid();
      component.toggleMenu(1);
      component.saveRole();

      expect(writeCalls[0].op).toBe('add');
      expect(writeCalls[0].args[0]).toMatchObject({ roleName: 'MARKETING', menuIds: [1] });
    });

    it('updates with the role id when one was being edited', () => {
      component.editRole(row);
      component.saveRole();

      expect(writeCalls[0].op).toBe('update');
      expect(writeCalls[0].args[0]).toBe(6);
    });

    it('sends the menu ids the checkboxes hold', () => {
      component.editRole(row);
      component.toggleMenu(2);
      component.saveRole();

      expect((writeCalls[0].args[1] as { menuIds: number[] }).menuIds).toEqual([1, 3, 2]);
    });
  });

  describe('the editor modal', () => {
    it('refuses to close while a save is in flight', () => {
      component.addRole();
      component.submitting.set(true);
      component.closeModal();

      expect(component.modalOpen()).toBe(true);
    });

    it('forgets the selection when closed', () => {
      component.editRole(row);
      component.closeModal();

      expect(component.editingRoleId).toBeNull();
      expect(component.roleForm.value.menuIds).toEqual([]);
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes by id', async () => {
      component.deleteRole(row);
      await Promise.resolve();

      expect(writeCalls[0].op).toBe('delete');
      expect(writeCalls[0].args[0]).toBe(6);
    });

    it('does nothing when the confirmation is declined', async () => {
      swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: false }) as never);

      component.deleteRole(row);
      await Promise.resolve();

      expect(writeCalls).toEqual([]);
    });
  });
});
