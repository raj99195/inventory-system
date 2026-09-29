/**
 * csvExport.ts — CSV generation and browser download helpers
 */

function escapeCell(val: unknown): string {
  if (val == null) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert array of objects → CSV string. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: (keyof T)[]
): string {
  if (!rows.length) return '';
  const cols = columns ?? (Object.keys(rows[0]) as (keyof T)[]);
  const header = cols.map((c) => escapeCell(String(c))).join(',');
  const body = rows
    .map((row) => cols.map((c) => escapeCell(row[c])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

/** Trigger a browser download of the CSV content (UTF-8 BOM for Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** One-shot: convert rows → CSV → download. Returns row count. */
export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: (keyof T)[]
): number {
  const csv = toCsv(rows, columns);
  downloadCsv(filename, csv);
  return rows.length;
}
