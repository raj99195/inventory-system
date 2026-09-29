import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface NativePermissionStatus {
  camera: PermissionStatus | string;
  location: PermissionStatus | string;
}

/**
 * useNativePermissions — on Android app start, checks and requests
 * Camera + Location permissions upfront so first-time attendance flow
 * doesn't need the user to visit Settings.
 *
 * Call ONCE from AuthProvider or App root.
 * On web this is a no-op.
 */
export function useNativePermissions(): NativePermissionStatus {
  const [status, setStatus] = useState<NativePermissionStatus>({
    camera: 'unknown',
    location: 'unknown',
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        // Camera
        let camPerms = await Camera.checkPermissions();
        if (
          camPerms.camera !== 'granted' &&
          camPerms.camera !== 'denied'
        ) {
          camPerms = await Camera.requestPermissions({
            permissions: ['camera'],
          });
        }

        // Small delay so the two Android dialogs don't collide
        await new Promise((r) => setTimeout(r, 400));

        // Location
        let locPerms = await Geolocation.checkPermissions();
        if (
          locPerms.location !== 'granted' &&
          locPerms.location !== 'denied'
        ) {
          locPerms = await Geolocation.requestPermissions({
            permissions: ['location', 'coarseLocation'],
          });
        }

        setStatus({
          camera: camPerms.camera || 'unknown',
          location: locPerms.location || 'unknown',
        });
      } catch (e) {
        // Silent — user can grant later from Settings or when actually needed
        console.warn('[useNativePermissions] request failed:', e);
      }
    })();
  }, []);

  return status;
}
