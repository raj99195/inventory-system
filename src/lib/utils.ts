import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: Date | string | { toDate: () => Date }): string {
  const date =
    typeof d === 'string' ? new Date(d) : 'toDate' in d ? d.toDate() : d;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(d: Date | string | { toDate: () => Date }): string {
  const date =
    typeof d === 'string' ? new Date(d) : 'toDate' in d ? d.toDate() : d;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function generateAssetId(count: number): string {
  return `AST-${String(count + 1).padStart(5, '0')}`;
}

export function generateEmployeeId(count: number): string {
  return `EMP-${String(count + 1).padStart(4, '0')}`;
}
