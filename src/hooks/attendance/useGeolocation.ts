import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { reverseGeocode } from '@/lib/attendance/geocode';

const isNative = Capacitor.isNativePlatform();

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
}

export interface UseGeolocationResult {
  location: CapturedLocation | null;
  loading: boolean;
  error: string | null;
  permissionState: PermissionState;
  refresh: () => Promise<CapturedLocation>;
  /** @deprecated Use `refresh` — kept for backward compat */
  capture: () => Promise<CapturedLocation>;
}

interface UseGeolocationOptions {
  autoFetch?: boolean;
}

/**
 * useGeolocation — auto-fetches on mount, with native + web permission handling.
 * Reverse-geocodes via Nominatim (best-effort; blank address on failure).
 */
export function useGeolocation(
  { autoFetch = true }: UseGeolocationOptions = {}
): UseGeolocationResult {
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('unknown');
  const hasStartedRef = useRef(false);

  const fetchOnce = useCallback(async (): Promise<CapturedLocation> => {
    setLoading(true);
    setError(null);
    try {
      let lat: number;
      let lng: number;
      let accuracy: number;

      if (isNative) {
        // Native (Android): check + request permission
        let perms = await Geolocation.checkPermissions();
        if (
          perms.location !== 'granted' &&
          perms.coarseLocation !== 'granted'
        ) {
          perms = await Geolocation.requestPermissions({
            permissions: ['location', 'coarseLocation'],
          });
        }
        setPermissionState(
          perms.location === 'granted' || perms.coarseLocation === 'granted'
            ? 'granted'
            : 'denied'
        );
        if (
          perms.location !== 'granted' &&
          perms.coarseLocation !== 'granted'
        ) {
          throw new Error(
            'Location permission denied. Enable it in Settings → Apps → STEMmantra → Permissions.'
          );
        }

        // High accuracy first, fallback to coarse
        let pos: Position;
        try {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        } catch {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 30000,
          });
        }
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      } else {
        // Web
        if (!navigator.geolocation) {
          throw new Error('Geolocation not supported by this browser');
        }
        const pos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            });
          }
        );
        setPermissionState('granted');
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      }

      const address = await reverseGeocode(lat, lng);
      const result: CapturedLocation = { lat, lng, accuracy, address };
      setLocation(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch location';
      setError(msg);
      const lower = msg.toLowerCase();
      if (lower.includes('denied') || lower.includes('permission')) {
        setPermissionState('denied');
      }
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount (one-shot)
  useEffect(() => {
    if (!autoFetch || hasStartedRef.current) return;
    hasStartedRef.current = true;
    fetchOnce().catch(() => {
      /* error captured in state */
    });
  }, [autoFetch, fetchOnce]);

  return {
    location,
    loading,
    error,
    permissionState,
    refresh: fetchOnce,
    capture: fetchOnce,
  };
}
