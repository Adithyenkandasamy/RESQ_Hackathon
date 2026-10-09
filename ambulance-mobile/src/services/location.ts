import * as Location from 'expo-location';
import { AmbulanceApi } from '../api/ambulance';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
  isStale?: boolean;
}

export type LocationFreshness = 'LIVE' | 'RECENT' | 'STALE' | 'UNAVAILABLE' | 'PERMISSION_DENIED';

let locationWatcher: Location.LocationSubscription | null = null;
let lastSyncedCoordinates: LocationCoordinates | null = null;
let lastSyncTimestamp: number | null = null;

export const LocationService = {
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('Location permission request failed:', e);
      return false;
    }
  },

  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  validateCoordinates(latitude: number, longitude: number): boolean {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
    if (isNaN(latitude) || isNaN(longitude)) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;
    // Reject dummy (0, 0) coordinates in the ocean
    if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return false;
    return true;
  },

  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const hasPerm = await this.requestPermission();
      if (!hasPerm) return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude, accuracy } = position.coords;

      if (!this.validateCoordinates(latitude, longitude)) {
        console.warn('Rejected invalid GPS coordinates:', latitude, longitude);
        return null;
      }

      const coords: LocationCoordinates = {
        latitude,
        longitude,
        accuracy,
        timestamp: position.timestamp || Date.now(),
      };

      lastSyncedCoordinates = coords;
      return coords;
    } catch (e) {
      console.warn('Failed to obtain device coordinates:', e);
      return null;
    }
  },

  async syncWithBackend(coords?: LocationCoordinates | null): Promise<boolean> {
    try {
      const targetCoords = coords || (await this.getCurrentLocation());
      if (!targetCoords || !this.validateCoordinates(targetCoords.latitude, targetCoords.longitude)) {
        return false;
      }
      await AmbulanceApi.updateLocation(targetCoords.latitude, targetCoords.longitude);
      lastSyncTimestamp = Date.now();
      lastSyncedCoordinates = targetCoords;
      return true;
    } catch (err) {
      console.warn('Failed to sync ambulance location with backend:', err);
      return false;
    }
  },

  getCachedLocation(): LocationCoordinates | null {
    return lastSyncedCoordinates;
  },

  isValidCoordinate(latitude: number, longitude: number): boolean {
    return this.validateCoordinates(latitude, longitude);
  },

  async startLiveTracking(
    onLocationUpdate?: (coords: LocationCoordinates) => void
  ): Promise<boolean> {
    try {
      const hasPerm = await this.requestPermission();
      if (!hasPerm) return false;

      // Stop any existing watcher
      await this.stopLiveTracking();

      locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000, // Update every 15 seconds to balance emergency tracking & battery
          distanceInterval: 20, // Or every 20 meters
        },
        async (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          if (this.validateCoordinates(latitude, longitude)) {
            const coords: LocationCoordinates = {
              latitude,
              longitude,
              accuracy,
              timestamp: location.timestamp || Date.now(),
            };

            // Synchronize with backend
            await this.syncWithBackend(coords);

            if (onLocationUpdate) {
              onLocationUpdate(coords);
            }
          }
        }
      );

      return true;
    } catch (e) {
      console.warn('Failed to start live location tracking:', e);
      return false;
    }
  },

  async stopLiveTracking(): Promise<void> {
    if (locationWatcher) {
      locationWatcher.remove();
      locationWatcher = null;
    }
  },

  getLastKnownCoordinates(): LocationCoordinates | null {
    return lastSyncedCoordinates;
  },

  getLastSyncTimestamp(): number | null {
    return lastSyncTimestamp;
  },

  getFreshness(timestamp?: number | null): LocationFreshness {
    if (!timestamp) return 'UNAVAILABLE';
    const ageMs = Date.now() - timestamp;
    if (ageMs < 30000) return 'LIVE'; // Under 30 seconds
    if (ageMs < 120000) return 'RECENT'; // Under 2 minutes
    return 'STALE'; // Over 2 minutes
  },
};
