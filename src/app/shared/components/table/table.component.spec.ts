import { SortEvent, TableColumn, TableComponent } from './table.component';

const column = (over: Partial<TableColumn> = {}): TableColumn => ({
  key: 'name',
  label: 'Name',
  ...over,
});

describe('TableComponent paging arithmetic', () => {
  let table: TableComponent;

  beforeEach(() => {
    table = new TableComponent();
    table.pageSize = 5;
  });

  it('reports one page when there is no data, so the footer never says page 1 of 0', () => {
    table.totalItems = 0;
    expect(table.totalPages).toBe(1);
  });

  it('rounds a partial last page up', () => {
    table.totalItems = 11;
    expect(table.totalPages).toBe(3);
  });

  it('reports one page when the data fits exactly', () => {
    table.totalItems = 5;
    expect(table.totalPages).toBe(1);
  });

  it('counts from one, not zero, because the footer is read by people', () => {
    table.totalItems = 12;
    table.currentPage = 1;

    expect(table.showingFrom).toBe(1);
    expect(table.showingTo).toBe(5);
  });

  it('shows the right slice on a middle page', () => {
    table.totalItems = 12;
    table.currentPage = 2;

    expect(table.showingFrom).toBe(6);
    expect(table.showingTo).toBe(10);
  });

  it('stops the last page at the real total rather than a full page width', () => {
    table.totalItems = 12;
    table.currentPage = 3;

    expect(table.showingFrom).toBe(11);
    expect(table.showingTo).toBe(12);
  });

  it('shows zero of zero rather than one of zero when empty', () => {
    table.totalItems = 0;
    table.currentPage = 1;

    expect(table.showingFrom).toBe(0);
    expect(table.showingTo).toBe(0);
  });
});

describe('TableComponent page window', () => {
  let table: TableComponent;

  beforeEach(() => {
    table = new TableComponent();
    table.pageSize = 5;
  });

  it('lists every page when there are fewer than the window', () => {
    table.totalItems = 15;
    table.currentPage = 1;

    expect(table.visiblePages).toEqual([1, 2, 3]);
  });

  it('never shows more than five page buttons', () => {
    table.totalItems = 500;
    table.currentPage = 50;

    expect(table.visiblePages).toHaveLength(5);
  });

  it('centres the window on the current page', () => {
    table.totalItems = 500;
    table.currentPage = 50;

    expect(table.visiblePages).toEqual([48, 49, 50, 51, 52]);
  });

  it('clamps the window at the start rather than showing page zero', () => {
    table.totalItems = 500;
    table.currentPage = 1;

    expect(table.visiblePages).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps the window at the end rather than running past the last page', () => {
    table.totalItems = 50;
    table.currentPage = 10;

    expect(table.visiblePages).toEqual([6, 7, 8, 9, 10]);
  });

  it('never lists a page beyond the total', () => {
    table.totalItems = 12;
    table.currentPage = 3;

    expect(Math.max(...table.visiblePages)).toBeLessThanOrEqual(table.totalPages);
  });
});

describe('TableComponent changePage', () => {
  let table: TableComponent;
  let emitted: number[];

  beforeEach(() => {
    table = new TableComponent();
    table.pageSize = 5;
    table.totalItems = 12;
    table.currentPage = 2;

    emitted = [];
    table.pageChange.subscribe((page) => emitted.push(page));
  });

  it('emits a page the user can actually reach', () => {
    table.changePage(3);
    expect(emitted).toEqual([3]);
  });

  it('ignores a page below one', () => {
    table.changePage(0);
    table.changePage(-4);
    expect(emitted).toEqual([]);
  });

  it('ignores a page past the end', () => {
    table.changePage(4);
    expect(emitted).toEqual([]);
  });

  it('ignores a click on the page already showing, so it does not refetch', () => {
    table.changePage(2);
    expect(emitted).toEqual([]);
  });
});

describe('TableComponent sorting', () => {
  let table: TableComponent;
  let emitted: SortEvent[];

  beforeEach(() => {
    table = new TableComponent();
    emitted = [];
    table.sortChange.subscribe((event) => emitted.push(event));
  });

  it('ignores a click on a column that is not sortable', () => {
    table.toggleSort(column({ sortable: false }));
    expect(emitted).toEqual([]);
  });

  it('sorts ascending the first time a column is clicked', () => {
    table.toggleSort(column({ sortable: true }));
    expect(emitted).toEqual([{ sortBy: 'name', sortDir: 'asc' }]);
  });

  it('flips to descending when the same column is clicked again', () => {
    table.sortBy = 'name';
    table.sortDir = 'asc';

    table.toggleSort(column({ sortable: true }));

    expect(emitted).toEqual([{ sortBy: 'name', sortDir: 'desc' }]);
  });

  it('returns to ascending on the third click', () => {
    table.sortBy = 'name';
    table.sortDir = 'desc';

    table.toggleSort(column({ sortable: true }));

    expect(emitted).toEqual([{ sortBy: 'name', sortDir: 'asc' }]);
  });

  it('starts a different column ascending rather than inheriting the other direction', () => {
    table.sortBy = 'name';
    table.sortDir = 'desc';

    table.toggleSort(column({ key: 'email', sortable: true }));

    expect(emitted).toEqual([{ sortBy: 'email', sortDir: 'asc' }]);
  });

  it('sorts by sortKey when the column names one, so a display key can differ', () => {
    table.toggleSort(column({ key: 'customer.customerName', sortKey: 'customerName', sortable: true }));

    expect(emitted).toEqual([{ sortBy: 'customerName', sortDir: 'asc' }]);
  });

  it('falls back to the column key when no sortKey is given', () => {
    expect(table.sortKeyOf(column())).toBe('name');
  });

  it('knows which column is the sorted one, by sortKey not by key', () => {
    table.sortBy = 'customerName';

    expect(table.isSortedBy(column({ key: 'customer.customerName', sortKey: 'customerName' }))).toBe(
      true,
    );
    expect(table.isSortedBy(column({ key: 'customerName' }))).toBe(true);
    expect(table.isSortedBy(column({ key: 'email' }))).toBe(false);
  });
});

describe('TableComponent sort icon', () => {
  let table: TableComponent;

  beforeEach(() => (table = new TableComponent()));

  it('shows nothing for a column that cannot be sorted', () => {
    expect(table.sortIcon(column({ sortable: false }))).toBe('');
  });

  it('shows the neutral arrow for a sortable column that is not the active one', () => {
    table.sortBy = 'email';
    expect(table.sortIcon(column({ sortable: true }))).toBe('↕');
  });

  it('points up when sorted ascending and down when descending', () => {
    table.sortBy = 'name';

    table.sortDir = 'asc';
    expect(table.sortIcon(column({ sortable: true }))).toBe('↑');

    table.sortDir = 'desc';
    expect(table.sortIcon(column({ sortable: true }))).toBe('↓');
  });
});

describe('TableComponent getValue', () => {
  let table: TableComponent;

  beforeEach(() => (table = new TableComponent()));

  it('reads a plain column', () => {
    expect(table.getValue({ name: 'Budi' }, 'name')).toBe('Budi');
  });

  it('walks a dotted path into a nested object', () => {
    expect(table.getValue({ customer: { customerName: 'Budi' } }, 'customer.customerName')).toBe(
      'Budi',
    );
  });

  it('walks more than two levels', () => {
    expect(table.getValue({ a: { b: { c: 7 } } }, 'a.b.c')).toBe(7);
  });

  it('gives undefined rather than throwing when a link in the path is missing', () => {
    expect(table.getValue({ customer: null }, 'customer.customerName')).toBeUndefined();
    expect(table.getValue({}, 'a.b.c')).toBeUndefined();
  });

  it('gives undefined for a null row', () => {
    expect(table.getValue(null, 'name')).toBeUndefined();
  });

  it('keeps a falsy value rather than treating it as missing', () => {
    expect(table.getValue({ count: 0 }, 'count')).toBe(0);
    expect(table.getValue({ active: false }, 'active')).toBe(false);
  });
});

describe('TableComponent row actions', () => {
  it('passes the whole row to edit and delete, not just an id', () => {
    const table = new TableComponent();
    const row = { branchId: 3, branchName: 'Jakarta' };

    let edited: unknown;
    let deleted: unknown;
    table.edit.subscribe((r) => (edited = r));
    table.delete.subscribe((r) => (deleted = r));

    table.onEdit(row);
    table.onDelete(row);

    expect(edited).toBe(row);
    expect(deleted).toBe(row);
  });

  it('emits the chosen page size as a number, not the select string', () => {
    const table = new TableComponent();

    let size: unknown;
    table.pageSizeChange.subscribe((value) => (size = value));

    table.onPageSizeChange({ target: { value: '25' } } as unknown as Event);

    expect(size).toBe(25);
    expect(typeof size).toBe('number');
  });
});
