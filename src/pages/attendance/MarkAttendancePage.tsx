import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Camera as CameraIcon,
  LogOut,
  CheckCircle2,
  Loader2,
  Building2,
  School as SchoolIcon,
  Home,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SelfieCapture } from '@/components/attendance/SelfieCapture';
import { LocationCapture } from '@/components/attendance/LocationCapture';
import { LocationTypePicker } from '@/components/attendance/LocationTypePicker';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useTodaysAttendance, checkIn, checkOut } from '@/hooks/useAttendance';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { useSchools } from '@/hooks/useSchools';
import { isWorkingDay, todayKey, fmtTime, minutesToHours } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import type { CapturedLocation } from '@/hooks/attendance/useGeolocation';
import type { LocationType } from '@/types';

export default function MarkAttendancePage() {
  // ─── ALL HOOKS UP-FRONT (Rules of Hooks — must run in same order every render) ───
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const uid = userDoc?.uid ?? null;

  const { record: today, loading: loadingToday } = useTodaysAttendance(uid);
  const { settings } = useAttendanceSettings();
  const { schools } = useSchools();

  const [selfie, setSelfie] = useState<string | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [notes, setNotes] = useState('');
  const defaultLocType: LocationType = userDoc?.assignedSchools?.length ? 'school' : 'office';
  const [locType, setLocType] = useState<LocationType>(defaultLocType);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Derived — always compute (safe even if userDoc null)
  const school = useMemo(
    () => (schoolId ? schools.find((s) => s.id === schoolId) ?? null : null),
    [schoolId, schools]
  );

  const mode: 'in' | 'out' | 'done' = !today?.checkInAt
    ? 'in'
    : !today.checkOutAt
    ? 'out'
    : 'done';

  // ─── GUARDS (after all hooks) ───
  if (!can('attendance.markOwn')) {
    return <Navigate to="/" replace />;
  }

  if (loadingToday || !userDoc) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );
  }

  const submit = async () => {
    if (!selfie) return toast.error('Please capture a selfie');
    if (!location) return toast.error('Please allow location access');
    if (mode === 'in' && locType === 'school' && !schoolId) {
      return toast.error('Please select a school');
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await checkIn({
          selfieBase64: selfie,
          location: { lat: location.lat, lng: location.lng },
          address: location.address,
          locationType: locType,
          schoolId,
          notes,
          user: userDoc,
          settings,
          school,
        });
        toast.success('Checked in successfully');
      } else {
        const outSchool = today?.schoolId
          ? schools.find((s) => s.id === today.schoolId) ?? null
          : null;
        await checkOut({
          selfieBase64: selfie,
          location: { lat: location.lat, lng: location.lng },
          address: location.address,
          notes,
          user: userDoc,
          settings,
          school: outSchool,
        });
        toast.success('Checked out successfully');
      }
      setSelfie(null);
      setLocation(null);
      setNotes('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  // ─── DONE STATE ──────────────────────────────────────
  if (mode === 'done' && today) {
    const LocIcon =
      today.locationType === 'school' ? SchoolIcon : today.locationType === 'wfh' ? Home : Building2;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card !p-6 sm:!p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-pastel-green flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-700" />
          </div>
          <h2 className="font-display text-3xl font-bold text-brand-choco">
            All done for today!
          </h2>
          <p className="text-brand-choco-soft mt-1">You've completed your work day.</p>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6 text-left">
            <div className="rounded-2xl bg-brand-cream-dark p-3">
              <div className="text-xs text-brand-choco-soft">Check-in</div>
              <div className="font-bold text-brand-choco text-sm">
                {fmtTime(today.checkInAt)}
              </div>
            </div>
            <div className="rounded-2xl bg-brand-cream-dark p-3">
              <div className="text-xs text-brand-choco-soft">Check-out</div>
              <div className="font-bold text-brand-choco text-sm">
                {fmtTime(today.checkOutAt)}
              </div>
            </div>
            <div className="rounded-2xl bg-brand-orange-50 p-3">
              <div className="text-xs text-brand-orange-dark">Total</div>
              <div className="font-bold text-brand-orange-dark text-sm">
                {minutesToHours(today.workingMinutes)}
              </div>
            </div>
          </div>

          {today.locationType && (
            <div className="mt-4 text-xs text-brand-choco-soft inline-flex items-center gap-1.5">
              <LocIcon className="w-3.5 h-3.5" />
              Location:{' '}
              <b className="text-brand-choco">
                {today.locationType === 'school'
                  ? `School — ${today.schoolName}`
                  : today.locationType === 'office'
                  ? 'Office'
                  : 'Work From Home'}
              </b>
            </div>
          )}

          {today.notes && (
            <div className="mt-5 text-left">
              <div className="text-sm font-semibold mb-1.5">Today's notes</div>
              <div className="rounded-2xl bg-brand-cream-dark p-3 text-sm text-brand-choco whitespace-pre-wrap">
                {today.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CHECK-IN / CHECK-OUT FORM ──────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="card !p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center text-white',
              mode === 'in' ? 'bg-brand-orange' : 'bg-green-600'
            )}
          >
            {mode === 'in' ? <CameraIcon className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="font-display text-2xl font-bold text-brand-choco">
              {mode === 'in' ? 'Check In' : 'Check Out'}
            </div>
            <div className="text-xs text-brand-choco-soft">
              {mode === 'in'
                ? 'Pick location type, take a selfie, confirm location'
                : `Checked in at ${fmtTime(today?.checkInAt)} — capture check-out selfie`}
            </div>
          </div>
        </div>
      </div>

      {mode === 'in' && (
        <>
        {locType === 'office' && !isWorkingDay(todayKey(), settings.workingDays, settings.saturdayOffWeeks) && (
          <p role="status" className="rounded-2xl bg-brand-orange-50 p-3 text-sm text-brand-choco">Today is an office day off. You can still record attendance if you are working; it will not be marked late.</p>
        )}
        <LocationTypePicker
          value={locType}
          schoolId={schoolId}
          onChange={({ locationType, schoolId: sId }) => {
            setLocType(locationType);
            setSchoolId(sId);
          }}
        />
        </>
      )}

      <div className="card !p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Selfie
        </div>
        <SelfieCapture
          onCapture={setSelfie}
          watermark={`${userDoc.name} · ${mode === 'in' ? 'Check-in' : 'Check-out'}`}
          disabled={busy}
        />
      </div>

      <LocationCapture onCapture={setLocation} />

      <div className="card !p-5">
        <label className="text-sm font-semibold mb-1.5 block">
          {mode === 'in' ? "Today's plan (optional)" : 'What did you do today? (optional)'}
        </label>
        <textarea
          className="input-field resize-none"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            mode === 'in'
              ? 'e.g. Client review, database migration…'
              : 'e.g. Fixed 3 bugs, met with vendor, sent quotation…'
          }
        />
      </div>

      <button
        className="btn-primary w-full py-3.5 text-base"
        onClick={submit}
        disabled={busy || !selfie || !location}
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Please wait…
          </>
        ) : mode === 'in' ? (
          'Mark Check-In'
        ) : (
          'Mark Check-Out'
        )}
      </button>
    </div>
  );
}