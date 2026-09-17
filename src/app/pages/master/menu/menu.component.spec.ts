import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject, throwError } from 'rxjs';

import { MenuService } from '../../../core/services/master/menu.services';

const swal = vi.hoisted(() => ({
  fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
}));

vi.mock('sweetalert2', () => ({ default: swal }));

const { MenuComponent } = await import('./menu.component');

const page = (content: unknown[], totalElements = content.length, totalPages = 1) => ({
  data: { content, totalElements, totalPages, page: 0, size: 5, first: true, last: true, empty: false },
});

describe('MenuComponent', () => {
  let component: InstanceType<typeof MenuComponent>;

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
          provide: MenuService,
          useValue: {
            getAllMenus: (params: unknown) => {
              listCalls.push(params);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
            addMenu: record('add'),
            updateMenu: record('update'),
            deleteMenu: record('delete'),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new MenuComponent(TestBed.inject(FormBuilder), TestBed.inject(MenuService)),
    );
  };

  const httpError = (message?: string) =>
    new HttpErrorResponse({ status: 400, error: message ? { message } : null });

  beforeEach(() => build());

  describe('loading the list', () => {
    it('asks for the first page on init', () => {
      component.ngOnInit();

      expect(listCalls).toHaveLength(1);
      expect(listCalls[0]).toMatchObject({ page: 0, size: 5, sortBy: 'menuId', sortDir: 'asc' });
    });

    it('converts the one-based page the table shows into the zero-based page the API wants', () => {
      component.currentPage = 3;
      component.loadMenus();

      expect(listCalls[0]).toMatchObject({ page: 2 });
    });

    it('trims the search term', () => {
      component.search = '  dash  ';
      component.loadMenus();

      expect(listCalls[0]).toMatchObject({ search: 'dash' });
    });

    it('fills the table and the total from the page', () => {
      component.loadMenus();
      list$.next(page([{ menuId: 1, menuName: 'Dashboard' }], 12));

      expect(component.menu()).toHaveLength(1);
      expect(component.totalElements()).toBe(12);
      expect(component.loading()).toBe(false);
    });

    it('treats a missing page body as an empty table rather than crashing', () => {
      component.loadMenus();
      list$.next({});

      expect(component.menu()).toEqual([]);
      expect(component.totalElements()).toBe(0);
    });

    it('spins while the request is in flight', () => {
      component.loadMenus();
      expect(component.loading()).toBe(true);
    });

    it('steps back when the current page no longer exists, as after deleting the last row', () => {
      component.currentPage = 5;
      component.loadMenus();
      listCalls.length = 0;

      list$.next(page([], 6, 2));

      expect(component.currentPage).toBe(2);
      expect(listCalls).toHaveLength(1);
      expect(listCalls[0]).toMatchObject({ page: 1 });
    });

    it('never steps back below page one', () => {
      component.currentPage = 3;
      component.loadMenus();
      list$.next(page([], 0, 0));

      expect(component.currentPage).toBe(1);
    });

    it('empties the table and explains the failure', () => {
      component.menu.set([{ menuId: 1, menuName: 'Dashboard' }]);
      listFails = httpError();

      component.loadMenus();

      expect(component.menu()).toEqual([]);
      expect(component.totalElements()).toBe(0);
      expect(component.loading()).toBe(false);
      expect(swal.fire).toHaveBeenCalled();
    });
  });

  describe('paging and sorting', () => {
    it('reloads on a page change', () => {
      component.onPageChange(4);

      expect(component.currentPage).toBe(4);
      expect(listCalls[0]).toMatchObject({ page: 3 });
    });

    it('returns to the first page when the page size changes', () => {
      component.currentPage = 7;
      component.onPageSizeChange(25);

      expect(component.pageSize).toBe(25);
      expect(component.currentPage).toBe(1);
      expect(listCalls[0]).toMatchObject({ page: 0, size: 25 });
    });

    it('returns to the first page when the sort changes', () => {
      component.currentPage = 7;
      component.onSortChange({ sortBy: 'menuName', sortDir: 'desc' });

      expect(component.currentPage).toBe(1);
      expect(listCalls[0]).toMatchObject({ sortBy: 'menuName', sortDir: 'desc', page: 0 });
    });
  });

  describe('the debounced search', () => {
    it('waits before asking, so typing does not fire a request per keystroke', () => {
      vi.useFakeTimers();
      component.ngOnInit();
      listCalls.length = 0;

      component.search = 'd';
      component.onSearch();
      component.search = 'da';
      component.onSearch();
      component.search = 'dash';
      component.onSearch();

      expect(listCalls).toHaveLength(0);

      vi.advanceTimersByTime(400);

      expect(listCalls).toHaveLength(1);
      expect(listCalls[0]).toMatchObject({ search: 'dash' });
      vi.useRealTimers();
    });

    it('returns to the first page for a new search', () => {
      vi.useFakeTimers();
      component.ngOnInit();
      component.currentPage = 5;
      listCalls.length = 0;

      component.search = 'dash';
      component.onSearch();
      vi.advanceTimersByTime(400);

      expect(component.currentPage).toBe(1);
      vi.useRealTimers();
    });

    it('ignores a repeat of the same term', () => {
      vi.useFakeTimers();
      component.ngOnInit();
      listCalls.length = 0;

      component.search = 'dash';
      component.onSearch();
      vi.advanceTimersByTime(400);
      component.onSearch();
      vi.advanceTimersByTime(400);

      expect(listCalls).toHaveLength(1);
      vi.useRealTimers();
    });
  });

  describe('the editor modal', () => {
    it('opens empty for a new menu', () => {
      component.addMenu();

      expect(component.modalOpen()).toBe(true);
      expect(component.editingMenuId).toBeNull();
      expect(component.menuForm.value.menuName).toBe('');
    });

    it('opens filled for an existing menu', () => {
      component.editMenu({ menuId: 7, menuName: 'Bucket' });

      expect(component.modalOpen()).toBe(true);
      expect(component.editingMenuId).toBe(7);
      expect(component.menuForm.value.menuName).toBe('Bucket');
    });

    it('closes and forgets what was being edited', () => {
      component.editMenu({ menuId: 7, menuName: 'Bucket' });
      component.closeModal();

      expect(component.modalOpen()).toBe(false);
      expect(component.editingMenuId).toBeNull();
      expect(component.menuForm.value.menuName).toBe('');
    });

    it('refuses to close while a save is in flight', () => {
      component.addMenu();
      component.submitting.set(true);

      component.closeModal();

      expect(component.modalOpen()).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends nothing while the form is invalid', () => {
      component.addMenu();
      component.saveMenu();

      expect(writeCalls).toEqual([]);
      expect(component.menuForm.get('menuName')?.touched).toBe(true);
    });

    it('creates when nothing was being edited', () => {
      component.addMenu();
      component.menuForm.setValue({ menuName: 'Reports' });
      component.saveMenu();

      expect(writeCalls[0].op).toBe('add');
      expect(writeCalls[0].args[0]).toEqual({ menuName: 'Reports' });
    });

    it('updates when a row was being edited, passing its id', () => {
      component.editMenu({ menuId: 7, menuName: 'Bucket' });
      component.menuForm.setValue({ menuName: 'Buckets' });
      component.saveMenu();

      expect(writeCalls[0].op).toBe('update');
      expect(writeCalls[0].args[0]).toBe(7);
      expect(writeCalls[0].args[1]).toEqual({ menuName: 'Buckets' });
    });

    it('returns to the first page after creating, so the new row is findable', () => {
      component.currentPage = 4;
      component.addMenu();
      component.menuForm.setValue({ menuName: 'Reports' });
      component.saveMenu();
      listCalls.length = 0;

      write$.next({});

      expect(component.currentPage).toBe(1);
      expect(listCalls).toHaveLength(1);
    });

    it('stays on the same page after updating', () => {
      component.currentPage = 4;
      component.editMenu({ menuId: 7, menuName: 'Bucket' });
      component.menuForm.setValue({ menuName: 'Buckets' });
      component.saveMenu();

      write$.next({});

      expect(component.currentPage).toBe(4);
    });

    it('closes the modal and stops submitting on success', () => {
      component.addMenu();
      component.menuForm.setValue({ menuName: 'Reports' });
      component.saveMenu();
      write$.next({});

      expect(component.submitting()).toBe(false);
      expect(component.modalOpen()).toBe(false);
    });

    it('keeps the modal open on failure, so the typing is not lost', () => {
      writeFails = httpError('Name already used.');
      component.addMenu();
      component.menuForm.setValue({ menuName: 'Reports' });
      component.saveMenu();

      expect(component.modalOpen()).toBe(true);
      expect(component.submitting()).toBe(false);
      expect(swal.fire).toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('asks before deleting', async () => {
      component.deleteMenu({ menuId: 7, menuName: 'Bucket' });
      await Promise.resolve();

      expect(swal.fire).toHaveBeenCalled();
    });

    it('deletes once the confirmation comes back', async () => {
      component.deleteMenu({ menuId: 7, menuName: 'Bucket' });
      await Promise.resolve();

      expect(writeCalls[0].op).toBe('delete');
      expect(writeCalls[0].args[0]).toBe(7);
    });

    it('does nothing when the confirmation is declined', async () => {
      swal.fire.mockImplementation(() => Promise.resolve({ isConfirmed: false }) as never);

      component.deleteMenu({ menuId: 7, menuName: 'Bucket' });
      await Promise.resolve();

      expect(writeCalls).toEqual([]);
    });

    it('refuses a row with no id rather than calling the api with undefined', async () => {
      component.deleteMenu({ menuName: 'Bucket' } as never);
      await Promise.resolve();

      expect(swal.fire).not.toHaveBeenCalled();
      expect(writeCalls).toEqual([]);
    });

    it('reloads the list afterwards', async () => {
      component.deleteMenu({ menuId: 7, menuName: 'Bucket' });
      await Promise.resolve();
      listCalls.length = 0;

      write$.next({});

      expect(listCalls).toHaveLength(1);
    });

    it('explains a failure instead of silently leaving the row', async () => {
      writeFails = httpError('Menu is in use.');

      component.deleteMenu({ menuId: 7, menuName: 'Bucket' });
      await Promise.resolve();

      expect(swal.fire).toHaveBeenCalledTimes(2);
    });
  });

  describe('the table configuration', () => {
    it('shows the id and the name', () => {
      expect(component.columns.map((c) => c.key)).toEqual(['menuId', 'menuName']);
    });

    it('lets both columns be sorted', () => {
      expect(component.columns.every((c) => c.sortable)).toBe(true);
    });
  });
});
