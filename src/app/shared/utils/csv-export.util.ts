
export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

function neutralise(text: string): string {
  return FORMULA_STARTERS.some((c) => text.startsWith(c)) ? `\t${text}` : text;
}

function escapeCell(value: CsvValue): string {
  if (value == null) return '';

  const raw = typeof value === 'string' ? neutralise(value) : String(value);

  return /[",\r\n\t]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
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

export function stampedFilename(prefix: string, extension = 'csv'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `${prefix}-${stamp}.${extension}`;
}

export function csvDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}
