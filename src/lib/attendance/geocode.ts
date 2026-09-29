/**
 * geocode.ts — Nominatim (OpenStreetMap) forward + reverse geocoding
 * Free, no API key needed. Rate limited (1 req/sec per IP recommended).
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodeAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: GeocodeAddress;
}

/** Reverse geocode: lat/lng → address string. Empty on failure/offline. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'STEMmantra-App/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data: NominatimResult = await res.json();
    return data.display_name ?? '';
  } catch (err) {
    console.warn('[geocode] reverseGeocode failed:', err);
    return '';
  }
}

/** Reverse geocode with structured address (city, state, etc.). */
export async function reverseGeocodeDetailed(
  lat: number,
  lng: number
): Promise<NominatimResult | null> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'STEMmantra-App/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return (await res.json()) as NominatimResult;
  } catch (err) {
    console.warn('[geocode] reverseGeocodeDetailed failed:', err);
    return null;
  }
}

/** Forward geocode: address string → lat/lng. */
export async function forwardGeocode(
  address: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!address || !address.trim()) return null;
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'STEMmantra-App/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const results: NominatimResult[] = await res.json();
    if (!results.length) return null;
    const r = results[0];
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      displayName: r.display_name,
    };
  } catch (err) {
    console.warn('[geocode] forwardGeocode failed:', err);
    return null;
  }
}

/**
 * Haversine distance in meters between two lat/lng points.
 * Used for geofence checks.
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Check if a point is inside a circular geofence. */
export function isInsideGeofence(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): boolean {
  return (
    distanceMeters(pointLat, pointLng, centerLat, centerLng) <= radiusMeters
  );
}
