import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';

import { LoanApplicationService } from '../../core/services/loan-application/loan-application.service';
import { LoanStatus, STATUS_GROUPS } from '../../models/loan-application/loan-application.models';

import { LoanApplicationComponent } from './loan-application.component';

const downloads: { name: string; blob: Blob }[] = [];

const ORIGINAL_CREATE_ELEMENT = document.createElement.bind(document);

const captureDownloads = () => {
  downloads.length = 0;

  URL.createObjectURL = vi.fn((blob: Blob) => {
    downloads.push({ name: '', blob });
    return 'blob:stub';
  }) as unknown as typeof URL.createObjectURL;

  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

  document.createElement = ((tag: string) => {
    const el = ORIGINAL_CREATE_ELEMENT(tag);
    if (tag === 'a') {
      (el as HTMLAnchorElement).click = () => {
        const last = downloads[downloads.length - 1];
        if (last) last.name = (el as HTMLAnchorElement).download;
      };
    }
    return el;
  }) as typeof document.createElement;
};

const releaseDownloads = () => {
  document.createElement = ORIGINAL_CREATE_ELEMENT as typeof document.createElement;
};

const csvRows = async (blob: Blob) =>
  (await blob.text()).split('\r\n').map((line) => line.split(','));

const pageOf = (over: Record<string, unknown> = {}) => ({
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
  empty: true,
  ...over,
});

const application = (over: Record<string, unknown> = {}) => ({
  applicationId: 'APP-0001',
  customer: { customerName: 'Budi Santoso', nik: '317', phoneNumber: '081' },
  requestedAmount: 10_000_000,
  tenor: 12,
  purpose: 'Renovasi',
  income: 8_000_000,
  status: LoanStatus.CHECKING,
  submissionDate: '2026-09-15T04:31:22.881Z',
  ...over,
});

describe('LoanApplicationComponent', () => {
  let component: InstanceType<typeof LoanApplicationComponent>;

  let listCalls: Record<string, unknown>[];
  let list$: Subject<any>;
  let listFails: unknown = null;

  const build = () => {
    TestBed.resetTestingModule();

    listCalls = [];
    list$ = new Subject<any>();
    listFails = null;
    captureDownloads();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LoanApplicationService,
          useValue: {
            list: (query: Record<string, unknown>) => {
              listCalls.push(query);
              return listFails ? throwError(() => listFails) : list$.asObservable();
            },
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new LoanApplicationComponent());
  };

  const lastQuery = () => listCalls[listCalls.length - 1];

  beforeEach(() => build());

  afterEach(() => releaseDownloads());

  describe('loading', () => {
    it('asks for the first page on init', () => {
      component.ngOnInit();

      expect(listCalls).toHaveLength(1);
      expect(lastQuery()).toMatchObject({ page: 0, size: 10, sortBy: 'submissionDate', sortDir: 'desc' });
    });

    it('fills the table and the paging figures', () => {
      component.load();
      list$.next(pageOf({ content: [application()], totalElements: 42, totalPages: 5, first: true, last: false }));

      expect(component.rows()).toHaveLength(1);
      expect(component.totalElements()).toBe(42);
      expect(component.totalPages()).toBe(5);
      expect(component.last()).toBe(false);
      expect(component.loading()).toBe(false);
    });

    it('empties the table and explains a failure', () => {
      listFails = { error: { message: 'Backend is down.' } };
      component.load();

      expect(component.rows()).toEqual([]);
      expect(component.error()).toBe('Backend is down.');
      expect(component.loading()).toBe(false);
    });

    it('falls back to wording that suggests a cause', () => {
      listFails = { status: 0 };
      component.load();

      expect(component.error()).toContain('Check your connection');
    });

    it('sends no search or dates when none are set', () => {
      component.load();

      expect(lastQuery()['search']).toBeUndefined();
      expect(lastQuery()['from']).toBeUndefined();
      expect(lastQuery()['to']).toBeUndefined();
    });
  });

  describe('the status tabs', () => {
    it('starts on the All tab, which sends no status filter', () => {
      expect(component.activeTab().key).toBe('all');
      expect(component.activeStatuses()).toEqual([]);
    });

    it('expands a tab into the statuses it covers', () => {
      component.selectTab(STATUS_GROUPS.find((g) => g.key === 'rejected')!);

      expect(component.activeStatuses()).toEqual([
        LoanStatus.REJECTED_BY_MARKETING,
        LoanStatus.REJECTED_BY_BRANCH_MANAGER,
        LoanStatus.REJECTED_BY_BACK_OFFICE,
      ]);
    });

    it('returns to the first page when the tab changes', () => {
      component.page.set(3);
      component.selectTab(STATUS_GROUPS.find((g) => g.key === 'pending')!);

      expect(component.page()).toBe(0);
      expect(listCalls).toHaveLength(1);
    });

    it('ignores a click on the tab already showing', () => {
      component.selectTab(component.activeTab());
      expect(listCalls).toEqual([]);
    });
  });

  describe('the date filter', () => {
    it('is absent until one end is filled in', () => {
      expect(component.hasDateFilter()).toBe(false);

      component.fromDate.set('2026-09-01');
      expect(component.hasDateFilter()).toBe(true);
    });

    it('complains when the start is after the end', () => {
      component.fromDate.set('2026-09-30');
      component.toDate.set('2026-09-01');

      expect(component.dateError()).toContain('after the end date');
    });

    it('allows a single day range', () => {
      component.fromDate.set('2026-09-15');
      component.toDate.set('2026-09-15');

      expect(component.dateError()).toBeNull();
    });

    it('does not complain when only one end is given', () => {
      component.fromDate.set('2026-09-30');
      expect(component.dateError()).toBeNull();
    });

    it('refuses to apply an impossible range', () => {
      component.fromDate.set('2026-09-30');
      component.toDate.set('2026-09-01');

      component.applyDateFilter();

      expect(listCalls).toEqual([]);
    });

    it('applies a valid range from the first page', () => {
      component.page.set(4);
      component.fromDate.set('2026-09-01');
      component.toDate.set('2026-09-15');

      component.applyDateFilter();

      expect(component.page()).toBe(0);
      expect(lastQuery()).toMatchObject({ from: '2026-09-01', to: '2026-09-15' });
    });

    it('clears the range and reloads', () => {
      component.fromDate.set('2026-09-01');
      component.clearDateFilter();

      expect(component.fromDate()).toBe('');
      expect(component.hasDateFilter()).toBe(false);
      expect(listCalls).toHaveLength(1);
    });

    it('does not reload when there was no range to clear', () => {
      component.clearDateFilter();
      expect(listCalls).toEqual([]);
    });
  });

  describe('the search box', () => {
    it('knows when what is typed differs from what was applied', () => {
      expect(component.searchDirty()).toBe(false);

      component.searchInput.set('budi');
      expect(component.searchDirty()).toBe(true);
    });

    it('ignores surrounding whitespace when deciding that', () => {
      component.appliedSearch.set('budi');
      component.searchInput.set('  budi  ');

      expect(component.searchDirty()).toBe(false);
    });

    it('applies a trimmed term from the first page', () => {
      component.page.set(2);
      component.searchInput.set('  budi ');
      component.submitSearch();

      expect(component.appliedSearch()).toBe('budi');
      expect(component.page()).toBe(0);
      expect(lastQuery()).toMatchObject({ search: 'budi' });
    });

    it('does not reload when the term has not changed', () => {
      component.appliedSearch.set('budi');
      component.searchInput.set('budi');
      component.submitSearch();

      expect(listCalls).toEqual([]);
    });

    it('clears both fields and reloads', () => {
      component.searchInput.set('budi');
      component.appliedSearch.set('budi');

      component.clearSearch();

      expect(component.searchInput()).toBe('');
      expect(component.appliedSearch()).toBe('');
      expect(listCalls).toHaveLength(1);
    });

    it('does not reload when there was nothing to clear', () => {
      component.clearSearch();
      expect(listCalls).toEqual([]);
    });
  });

  describe('paging', () => {
    it('reports a one-based range for the footer', () => {
      component.page.set(1);
      component.size.set(10);
      component.rows.set([application(), application()] as never);
      component.totalElements.set(12);

      expect(component.rangeStart()).toBe(11);
      expect(component.rangeEnd()).toBe(12);
    });

    it('reports zero of zero when there is nothing', () => {
      expect(component.rangeStart()).toBe(0);
      expect(component.rangeEnd()).toBe(0);
    });

    it('lists every page while there are seven or fewer', () => {
      component.totalPages.set(7);
      expect(component.pageNumbers()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('collapses the middle with ellipses on a long list', () => {
      component.totalPages.set(20);
      component.page.set(9);

      expect(component.pageNumbers()).toEqual([1, '…', 9, 10, 11, '…', 20]);
    });

    it('shows no leading ellipsis near the start', () => {
      component.totalPages.set(20);
      component.page.set(0);

      expect(component.pageNumbers()[1]).not.toBe('…');
    });

    it('always offers the first and last page', () => {
      component.totalPages.set(50);
      component.page.set(25);

      const pages = component.pageNumbers();
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(50);
    });

    it('ignores a click on an ellipsis', () => {
      component.totalPages.set(20);
      component.goToPage('…');

      expect(listCalls).toEqual([]);
    });

    it('changes the page size and returns to the first page', () => {
      component.page.set(3);
      component.changeSize(25);

      expect(component.size()).toBe(25);
      expect(component.page()).toBe(0);
    });
  });

  describe('sorting', () => {
    it('sorts a new field ascending', () => {
      component.toggleSort('requestedAmount');

      expect(component.sortBy()).toBe('requestedAmount');
      expect(component.sortDir()).toBe('asc');
    });

    it('flips direction on the field already sorted', () => {
      component.toggleSort('submissionDate');
      expect(component.sortDir()).toBe('asc');

      component.toggleSort('submissionDate');
      expect(component.sortDir()).toBe('desc');
    });
  });

  describe('exporting', () => {
    const exportAndFlush = (res: Record<string, unknown>) => {
      component.exportCsv();
      list$.next(pageOf(res));
    };

    it('asks for one big page rather than the page on screen', () => {
      component.page.set(3);
      component.exportCsv();

      expect(lastQuery()).toMatchObject({ page: 0, size: 5000 });
    });

    it('honours the tab, the search and the date range', () => {
      component.selectTab(STATUS_GROUPS.find((g) => g.key === 'approved')!);
      component.appliedSearch.set('budi');
      component.fromDate.set('2026-09-01');
      listCalls.length = 0;

      component.exportCsv();

      expect(lastQuery()).toMatchObject({
        search: 'budi',
        from: '2026-09-01',
        statuses: [LoanStatus.VERIFIED, LoanStatus.DISBURSED],
      });
    });

    it('writes a header row followed by one row per application', async () => {
      exportAndFlush({ content: [application(), application()], totalElements: 2 });

      expect(downloads).toHaveLength(1);
      expect(await csvRows(downloads[0].blob)).toHaveLength(3);
    });

    it('stamps the file name so two exports do not overwrite each other', () => {
      exportAndFlush({ content: [application()], totalElements: 1 });

      expect(downloads[0].name).toMatch(/^applications-\d{4}-\d{2}-\d{2}_\d{4}\.csv$/);
    });

    it('writes the human status label rather than the enum', async () => {
      exportAndFlush({
        content: [application({ status: LoanStatus.PENDING_BACK_OFFICE })],
        totalElements: 1,
      });

      const text = await downloads[0].blob.text();
      expect(text).toContain('With back office');
      expect(text).not.toContain('PENDING_BACK_OFFICE');
    });

    it('writes only the date half of the submission timestamp', async () => {
      exportAndFlush({ content: [application()], totalElements: 1 });

      const text = await downloads[0].blob.text();
      expect(text).toContain('2026-09-15');
      expect(text).not.toContain('T04:31:22');
    });

    it('writes an empty cell rather than the word undefined for a missing customer', async () => {
      exportAndFlush({ content: [application({ customer: null })], totalElements: 1 });

      const text = await downloads[0].blob.text();
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('null');
    });

    it('defuses a formula a customer typed into the loan purpose', async () => {
      exportAndFlush({
        content: [application({ purpose: '=HYPERLINK("http://evil.test")' })],
        totalElements: 1,
      });

      const text = await downloads[0].blob.text();
      expect(text).toContain('\t=HYPERLINK');
    });

    it('prefixes the file with a UTF-8 BOM so Excel reads Indonesian names correctly', async () => {
      exportAndFlush({ content: [application()], totalElements: 1 });

      const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    });

    it('says so when the export was truncated, instead of silently losing rows', () => {
      exportAndFlush({ content: [application()], totalElements: 9000 });

      expect(component.exportNote()).toContain('first 1 of 9000');
    });

    it('stays quiet when everything fitted', () => {
      exportAndFlush({ content: [application()], totalElements: 1 });

      expect(component.exportNote()).toBeNull();
    });

    it('refuses while an export is already running', () => {
      component.exportCsv();
      listCalls.length = 0;

      component.exportCsv();

      expect(listCalls).toEqual([]);
    });

    it('refuses while the date range is impossible', () => {
      component.fromDate.set('2026-09-30');
      component.toDate.set('2026-09-01');

      component.exportCsv();

      expect(listCalls).toEqual([]);
    });

    it('writes no file and explains a failure', () => {
      listFails = { error: { message: 'Export refused.' } };
      component.exportCsv();

      expect(downloads).toEqual([]);
      expect(component.exportError()).toBe('Export refused.');
      expect(component.exporting()).toBe(false);
    });
  });

  describe('the detail modal', () => {
    it('opens on a row and closes again', () => {
      const row = application();

      component.view(row as never);
      expect(component.selected()).toBe(row);

      component.closeModal();
      expect(component.selected()).toBeNull();
    });
  });

  describe('display helpers', () => {
    it('formats an amount as rupiah without decimals', () => {
      const formatted = component.formatRupiah(10_000_000);

      expect(formatted).toContain('10.000.000');
      expect(formatted).not.toContain(',00');
    });

    it('shows a dash rather than Rp 0 for a missing amount', () => {
      expect(component.formatRupiah(null)).toBe('—');
      expect(component.formatRupiah(undefined)).toBe('—');
    });

    it('formats a real zero as a currency amount', () => {
      expect(component.formatRupiah(0)).toContain('0');
    });

    it('takes two initials from a name', () => {
      expect(component.initials('Budi Santoso')).toBe('BS');
    });

    it('takes only the first two words of a longer name', () => {
      expect(component.initials('Budi Santoso Wijaya')).toBe('BS');
    });

    it('copes with extra spaces', () => {
      expect(component.initials('  Budi   Santoso ')).toBe('BS');
    });

    it('shows a question mark when there is no name', () => {
      expect(component.initials(null)).toBe('?');
      expect(component.initials('')).toBe('?');
    });

    it('gives the same avatar colour for the same name every time', () => {
      expect(component.avatarTint('Budi Santoso')).toBe(component.avatarTint('Budi Santoso'));
    });

    it('gives a colour from its own palette', () => {
      expect(component.avatarTint('Budi')).toMatch(/^bg-[a-z]+-\d00$/);
    });

    it('falls back to a neutral chip for a status it does not know', () => {
      expect(component.statusStyle('SOMETHING_NEW' as LoanStatus).classes).toContain('slate');
    });
  });
});
