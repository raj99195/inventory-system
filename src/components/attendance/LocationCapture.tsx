import { useEffect } from 'react';
import { MapPin, RefreshCw, Loader2 } from 'lucide-react';
import {
  useGeolocation,
  type CapturedLocation,
} from '@/hooks/attendance/useGeolocation';
import { cn } from '@/lib/utils';

interface LocationCaptureProps {
  onCapture?: (location: CapturedLocation) => void;
}

/**
 * LocationCapture — auto-fetches location on mount, shows status,
 * bubbles the captured location up via onCapture.
 */
export function LocationCapture({ onCapture }: LocationCaptureProps) {
  const { location, loading, error, refresh, permissionState } = useGeolocation(
    { autoFetch: true }
  );

  // Pass captured location to parent whenever it changes
  useEffect(() => {
    if (location) onCapture?.(location);
  }, [location, onCapture]);

  return (
    <div className="card !p-4 sm:!p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            location
              ? 'bg-pastel-green text-green-700'
              : error
              ? 'bg-red-100 text-red-600'
              : 'bg-brand-orange-100 text-brand-orange-dark'
          )}
        >
          <MapPin className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-brand-choco">Location</div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="text-sm font-semibold text-brand-orange-dark hover:text-brand-orange disabled:text-brand-choco-soft flex items-center gap-1"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </>
              )}
            </button>
          </div>

          {loading && !location && (
            <div className="mt-1 text-sm text-brand-choco-soft">
              Fetching your location…
            </div>
          )}

          {error && (
            <div className="mt-1 text-sm text-red-600 break-words">
              {error}
              {permissionState === 'denied' && (
                <div className="mt-2 text-xs text-brand-choco-light">
                  Open <b>Settings → Apps → STEMmantra → Permissions → Location</b>
                  {' '}and select "Allow only while using the app", then tap Refresh.
                </div>
              )}
            </div>
          )}

          {location && (
            <>
              <div className="mt-1 text-sm text-brand-choco break-words">
                {location.address ||
                  `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
              </div>
              <div className="mt-1 text-[11px] text-brand-choco-soft">
                Accuracy ±{Math.round(location.accuracy || 0)}m ·{' '}
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
