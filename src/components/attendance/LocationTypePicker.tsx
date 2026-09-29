import { useMemo, useEffect } from 'react';
import {
  School as SchoolIcon,
  Building2,
  Home,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSchools,
  filterUserAssignedSchools,
} from '@/hooks/useSchools';
import type { LocationType } from '@/types';
import { cn } from '@/lib/utils';

interface LocationTypePickerProps {
  value: LocationType | null;
  schoolId: string | null;
  onChange: (payload: {
    locationType: LocationType;
    schoolId: string | null;
  }) => void;
}

interface OptionMeta {
  key: LocationType;
  label: string;
  icon: typeof SchoolIcon;
  desc: string;
}

const OPTIONS: OptionMeta[] = [
  {
    key: 'school',
    label: 'School',
    icon: SchoolIcon,
    desc: 'At an assigned school',
  },
  {
    key: 'office',
    label: 'Office',
    icon: Building2,
    desc: 'From head office',
  },
  {
    key: 'wfh',
    label: 'WFH',
    icon: Home,
    desc: 'From home',
  },
];

export function LocationTypePicker({
  value,
  schoolId,
  onChange,
}: LocationTypePickerProps) {
  const { userDoc } = useAuth();
  const { schools: allSchools, loading } = useSchools();

  const mySchools = useMemo(
    () =>
      filterUserAssignedSchools(allSchools, userDoc?.assignedSchools).filter(
        (s) => s.active !== false
      ),
    [allSchools, userDoc?.assignedSchools]
  );

  const hasOnlyOneSchool = mySchools.length === 1;
  const singleSchool = hasOnlyOneSchool ? mySchools[0] : null;

  // When user picks 'school' and has exactly one school, auto-select it silently
  useEffect(() => {
    if (value === 'school' && hasOnlyOneSchool && singleSchool && schoolId !== singleSchool.id) {
      onChange({ locationType: 'school', schoolId: singleSchool.id });
    }
  }, [value, hasOnlyOneSchool, singleSchool, schoolId, onChange]);

  const pickType = (key: LocationType) => {
    if (key === 'school') {
      onChange({
        locationType: 'school',
        schoolId: mySchools[0]?.id ?? null,
      });
    } else {
      onChange({ locationType: key, schoolId: null });
    }
  };

  const pickSchool = (id: string) =>
    onChange({ locationType: 'school', schoolId: id });

  return (
    <div className="card !p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft">
        Where are you working from?
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {OPTIONS.map((o) => {
          const disabled = o.key === 'school' && !mySchools.length;
          const active = value === o.key;
          const Icon = o.icon;
          return (
            <button
              type="button"
              key={o.key}
              onClick={() => !disabled && pickType(o.key)}
              disabled={disabled}
              className={cn(
                'rounded-2xl border p-3 text-left transition',
                active
                  ? 'border-brand-orange bg-brand-orange-50 ring-2 ring-brand-orange-100'
                  : 'border-brand-choco/10 hover:border-brand-choco/25',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
              title={disabled ? 'No schools assigned to you' : ''}
            >
              <Icon
                className={cn(
                  'w-6 h-6',
                  active ? 'text-brand-orange-dark' : 'text-brand-choco'
                )}
              />
              <div className="text-sm font-bold text-brand-choco mt-1">
                {o.label}
              </div>
              <div className="text-[10px] text-brand-choco-soft leading-tight mt-0.5">
                {o.desc}
              </div>
            </button>
          );
        })}
      </div>

      {value === 'school' && (
        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-brand-choco-soft flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading schools…
            </div>
          ) : mySchools.length === 0 ? (
            <div className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-200 p-3">
              No schools assigned. Contact admin.
            </div>
          ) : hasOnlyOneSchool && singleSchool ? (
            // ─── Single school: auto-selected info card ───
            <div className="rounded-2xl bg-brand-orange-50 border border-brand-orange/20 p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange text-white flex items-center justify-center flex-shrink-0">
                  <SchoolIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-brand-choco">
                      {singleSchool.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Auto-selected
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-brand-choco-soft mt-0.5">
                    <Clock className="w-3 h-3" />
                    In {singleSchool.inTime} · Out {singleSchool.outTime}
                  </div>
                  {singleSchool.address && (
                    <div className="text-[11px] text-brand-choco-soft mt-1 truncate">
                      {singleSchool.address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // ─── Multiple schools: dropdown ───
            <>
              <label className="text-sm font-semibold mb-1.5 block">
                Select school
              </label>
              <select
                className="input-field"
                value={schoolId || ''}
                onChange={(e) => pickSchool(e.target.value)}
              >
                {mySchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · in {s.inTime}, out {s.outTime}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {value === 'wfh' && (
        <div className="mt-3 text-xs text-brand-choco-soft rounded-lg bg-brand-cream-dark p-2.5">
          WFH marked — geofence check skipped, but location still recorded for verification.
        </div>
      )}
    </div>
  );
}
