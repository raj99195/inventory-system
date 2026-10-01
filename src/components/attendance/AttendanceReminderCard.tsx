import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAttendanceReminders } from '@/contexts/AttendanceReminderContext';

export default function AttendanceReminderCard() {
  const reminders = useAttendanceReminders();
  if (!reminders) return null;
  const { status, shift } = reminders;
  return <section className="card !p-4 space-y-3" aria-label="Attendance reminders">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-brand-orange-50 text-brand-orange flex items-center justify-center">{status === 'disabled' ? <BellOff size={19} /> : <Bell size={19} />}</span>
        <div><h2 className="text-sm font-bold">Attendance Reminders</h2><p className="text-xs text-brand-choco-soft mt-1">Notify me 15 minutes before check-in and check-out on working days.</p></div>
      </div>
      {status === 'loading' ? <Loader2 aria-label="Updating reminders" className="w-4 h-4 animate-spin text-brand-orange" />
        : status === 'enabled' ? <button type="button" className="btn-secondary text-xs" onClick={reminders.disable}>Turn off</button>
        : status === 'exact-permission' ? <button type="button" className="btn-primary text-xs" onClick={() => void reminders.allowExact()}>Allow precise reminders</button>
        : <button type="button" className="btn-primary text-xs" onClick={() => void reminders.enable()}>{status === 'error' ? 'Retry' : 'Enable reminders'}</button>}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-semibold flex items-center gap-2">Reminder location<select className="input-field !py-2 !text-xs !w-auto max-w-60" value={shift?.id ?? ''} onChange={(event) => reminders.selectShift(event.target.value)}>{reminders.shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {shift && <p className="text-xs text-brand-choco-soft">Check-in {shift.start} · Check-out {shift.end}</p>}
    </div>
    <p role="status" className="text-xs text-brand-choco-soft">
      {status === 'enabled' ? 'Reminders are on. Tap a notification to open attendance.'
        : status === 'disabled' ? 'Reminders are off on this device.'
        : status === 'permission' ? 'Allow notifications when prompted. If previously blocked, enable notifications in Android app settings.'
        : status === 'exact-permission' ? 'Allow Alarms & reminders in Android settings to deliver reminders at the correct time.'
        : status === 'error' ? reminders.error : 'Updating reminder timings…'}
    </p>
  </section>;
}
