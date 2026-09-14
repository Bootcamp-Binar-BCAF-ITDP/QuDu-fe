/**
 * CSV export, written to open cleanly in Excel without a library.
 *
 * XLSX would need SheetJS or ExcelJS in the bundle. CSV needs nothing, and with
 * the byte order mark below Excel opens it directly with the right encoding, so
 * the extra weight buys only cell formatting.
 */

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Excel and Google Sheets treat a leading =, +, - or @ as a formula, so a
 * customer who types "=1+1" into a loan purpose would have it executed on the
 * reviewer's machine when they open the export. Prefixing a tab neutralises it
 * while keeping the text readable in the cell.
 *
 * Tab and carriage return lead the same way, which is why they are here too.
 */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

function neutralise(text: string): string {
  return FORMULA_STARTERS.some((c) => text.startsWith(c)) ? `\t${text}` : text;
}

/** RFC 4180: wrap in quotes when needed, and double any quote inside. */
function escapeCell(value: CsvValue): string {
  if (value == null) return '';

  const raw = typeof value === 'string' ? neutralise(value) : String(value);

  return /[",\r\n\t]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(rows: CsvValue[][]): string {
  // CRLF, because Excel on Windows treats a lone LF as part of the cell.
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/**
 * Hands the browser a file.
 *
 * The object URL is revoked on the next tick rather than immediately: some
 * browsers have not finished reading the blob when click() returns, and
 * revoking too early produces an empty download with no error.
 */
export function downloadCsv(filename: string, csv: string): void {
  // Written as an escape, not the literal character: an invisible U+FEFF in
  // source is the kind of thing an editor or a formatter silently eats, and
  // without it Excel reads the file as ANSI and mangles every accented name.
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportCsv(filename: string, rows: CsvValue[][]): void {
  downloadCsv(filename, toCsv(rows));
}

/** `applications-2026-09-14.csv` — sortable, and unique enough per day. */
export function stampedFilename(prefix: string, extension = 'csv'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `${prefix}-${stamp}.${extension}`;
}

/**
 * Dates reach us as ISO strings and go out unchanged.
 *
 * Deliberately not localised: a spreadsheet is usually the input to something
 * else, and 2026-09-14 sorts correctly as text in every locale while
 * "14/09/2026" does not.
 */
export function csvDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}
