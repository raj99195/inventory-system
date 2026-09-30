import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Holiday { id: string; name: string; date: string; endDate?: string; }
export function validateHolidays(year: number, holidays: Holiday[]) {
  if (!Number.isInteger(year) || year < 2026 || year > 2200) throw new Error('Choose a year between 2026 and 2200.');
  const dates = new Set<string>();
  for (const holiday of holidays) {
    const endDate = holiday.endDate || holiday.date;
    if (!holiday.name.trim()) throw new Error('Enter a name for every holiday.');
    for (const value of [holiday.date, endDate]) {
      const date = new Date(value + 'T12:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value || date.getUTCFullYear() !== year) throw new Error('From and To dates must be valid dates in the selected year.');
    }
    if (endDate < holiday.date) throw new Error('To Date must be on or after From Date.');
    for (let day = Date.parse(holiday.date + 'T00:00:00Z'); day <= Date.parse(endDate + 'T00:00:00Z'); day += 86400000) {
      const key = new Date(day).toISOString().slice(0,10);
      if (dates.has(key)) throw new Error('Holiday date ranges overlap. Combine entries or choose different dates.');
      dates.add(key);
    }
  }
}
export function holidayDays(holiday: Holiday): number {
  return Math.max(0, Math.round((Date.parse((holiday.endDate || holiday.date) + 'T00:00:00Z') - Date.parse(holiday.date + 'T00:00:00Z')) / 86400000) + 1) || 0;
}
export function useHolidayCalendar(year: number) {
  const [state, setState] = useState<{year: number; holidays: Holiday[]; loading: boolean; error: string}>({year, holidays: [], loading: true, error: ''});
  useEffect(() => {
    setState({year, holidays: [], loading: true, error: ''});
    return onSnapshot(doc(db, 'settings', `holidays-${year}`), snapshot => {
      setState({year, holidays: ((snapshot.data()?.holidays ?? []) as Holiday[]).map(h => ({...h, endDate: h.endDate === h.date ? '' : h.endDate || ''})), loading: false, error: ''});
    }, error => setState({year, holidays: [], loading: false, error: error.message}));
  }, [year]);
  return state.year === year ? state : {year, holidays: [], loading: true, error: ''};
}
export async function saveHolidayCalendar(year: number, holidays: Holiday[]) {
  validateHolidays(year, holidays);
  await setDoc(doc(db, 'settings', `holidays-${year}`), {
    year, holidays: holidays.map(h => ({...h, name: h.name.trim(), endDate: h.endDate || ''})).sort((a,b) => a.date.localeCompare(b.date)), updatedAt: serverTimestamp(),
  });
}

export function holidayInMonth(holiday: Holiday, year: number, month: string): boolean {
  if (!month) return true;
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-${new Date(Date.UTC(year, Number(month), 0)).getUTCDate()}`;
  return holiday.date <= end && (holiday.endDate || holiday.date) >= start;
}
