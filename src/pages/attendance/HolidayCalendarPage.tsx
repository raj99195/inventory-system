import { useState } from 'react';
import { CalendarDays, Plus, Trash2, Save } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useHolidayCalendar, saveHolidayCalendar, holidayInMonth, type Holiday } from '@/hooks/useHolidayCalendar';

export default function HolidayCalendarPage() {
  const [year, setYear] = useState(Math.max(2026, new Date().getFullYear()));
  const { holidays, loading, error } = useHolidayCalendar(year);
  const { can } = usePermission();
  const canEdit = can('settings.edit');
  const [draft, setDraft] = useState<Holiday[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [month, setMonth] = useState('');
  const rows = [...(draft ?? holidays)].filter(h => holidayInMonth(h, year, month)).sort((a,b) => a.date.localeCompare(b.date));
  const update = (id: string, patch: Partial<Holiday>) => setDraft((draft ?? holidays).map(h => h.id === id ? {...h, ...patch} : h));
  const save = async () => {
    if (!canEdit || loading || error || saving) return;
    setSaving(true); setMessage('');
    try { await saveHolidayCalendar(year, draft ?? holidays); setDraft(null); setMessage('Holiday calendar saved. Employees can now see these holidays.'); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Could not save holidays.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div><p className="text-xs font-bold uppercase text-brand-orange">HRMS</p><h1 className="font-display text-3xl lg:text-4xl font-bold mt-2">Holiday Calendar</h1><p className="text-brand-choco-soft mt-2">Festival and company holidays for each year. These are separate from personal leave balances.</p></div>
      <div className="flex flex-wrap gap-3"><label className="text-sm font-semibold">Year<select aria-label="Calendar year" className="input-field mt-1" value={year} disabled={saving || draft !== null} onChange={e => {setYear(Number(e.target.value));setMessage('');}}>{Array.from({length: Math.max(2026, new Date().getFullYear()) + 10 - 2026 + 1}, (_,i) => 2026+i).map(y => <option key={y}>{y}</option>)}</select></label>
      <label className="text-sm font-semibold">Month<select aria-label="Filter holidays by month" className="input-field mt-1" value={month} onChange={e => setMonth(e.target.value)}><option value="">All Months</option>{Array.from({length:12}, (_,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{new Date(2026,i,1).toLocaleDateString('en-IN',{month:'long'})}</option>)}</select></label></div>
    </div>
    {loading ? <div className="card">Loading holidays...</div> : error ? <div className="card text-red-600" role="alert">Unable to load holidays. Please reload and try again.</div> : <>
      {canEdit && <div className="flex flex-wrap gap-3 items-center">
        <button className="btn-secondary" disabled={saving} onClick={() => setDraft([...(draft ?? holidays), {id: crypto.randomUUID(), name: '', date: `${year}-${month || '01'}-01`, endDate: ''}])}><Plus className="w-4 h-4"/>Add Holiday</button>
        <button className="btn-primary" disabled={saving || draft === null} onClick={save}><Save className="w-4 h-4"/>{saving ? 'Saving...' : 'Save Calendar'}</button>
        {draft !== null && <button className="btn-secondary" disabled={saving} onClick={() => {setDraft(null);setMessage('');}}>Discard Changes</button>}
        {draft !== null && <span className="text-sm text-brand-choco-soft">Save or discard changes before switching years.</span>}
      </div>}
      {message && <p role="status" className="card !p-4">{message}</p>}
      {!rows.length ? <div className="card text-center py-12"><CalendarDays className="w-10 h-10 mx-auto text-brand-orange mb-4"/><h2 className="font-display text-xl font-bold">{month ? 'No holidays for this month' : `No holidays published for ${year}`}</h2><p className="text-brand-choco-soft mt-2">{month ? 'Choose another month or All Months to see other holidays.' : canEdit ? 'Add festival names and dates, then save this calendar.' : 'Holidays will appear here once your admin publishes the calendar.'}</p></div> : <div className="grid gap-4 md:grid-cols-2">
        {rows.map(holiday => <div key={holiday.id} className="card !p-5">
          {canEdit ? <div className="flex gap-3 items-end"><div className="flex-1 min-w-0 space-y-3"><label className="block text-sm font-semibold">Holiday / Festival<input className="input-field mt-1" value={holiday.name} disabled={saving} onChange={e => update(holiday.id, {name: e.target.value})} placeholder="e.g. Diwali"/></label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">From Date<input type="date" className="input-field mt-1" min={`${year}-01-01`} max={`${year}-12-31`} value={holiday.date} disabled={saving} onChange={e => update(holiday.id, {date: e.target.value})}/></label>
              <label className="block text-sm font-semibold">To Date (optional)<input type="date" className="input-field mt-1" min={holiday.date || `${year}-01-01`} max={`${year}-12-31`} value={holiday.endDate || ''} disabled={saving} onChange={e => update(holiday.id, {endDate: e.target.value})}/></label>
            </div></div><button aria-label={`Remove ${holiday.name || 'holiday'}`} className="w-11 h-11 shrink-0 flex items-center justify-center text-red-600 rounded-xl hover:bg-red-50" disabled={saving} onClick={() => setDraft((draft ?? holidays).filter(h => h.id !== holiday.id))}><Trash2 className="w-5 h-5"/></button></div> : <><h2 className="font-bold text-lg">{holiday.name}</h2><p className="text-brand-choco-soft mt-2">{formatHolidayDate(holiday.date)}{holiday.endDate && holiday.endDate !== holiday.date ? ` to ${formatHolidayDate(holiday.endDate)}` : ''}</p><span className="inline-block mt-3 text-xs font-semibold rounded-full px-3 py-1 bg-brand-orange-50 text-brand-orange">Company Holiday</span></>}
        </div>)}
      </div>}
    </>}
  </div>;
}

function formatHolidayDate(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
}
