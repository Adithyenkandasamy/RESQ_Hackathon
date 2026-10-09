import React from 'react';
import { View, StyleSheet, Platform, Linking, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';
import { Typography } from '../constants/typography';
import { Navigation } from 'lucide-react-native';

interface MapCoordinate {
  latitude: number;
  longitude: number;
  title?: string;
  type?: 'ambulance' | 'incident' | 'hospital';
}

interface MapViewComponentProps {
  incidentLocation?: { latitude: number; longitude: number; label?: string } | null;
  hospitalLocation?: { latitude: number; longitude: number; label?: string } | null;
  ambulanceLocation?: { latitude: number; longitude: number } | null;
  height?: number;
  showNavigationButton?: boolean;
}

export const MapViewComponent: React.FC<MapViewComponentProps> = ({
  incidentLocation,
  hospitalLocation,
  ambulanceLocation,
  height = 240,
  showNavigationButton = true,
}) => {
  const centerLat =
    hospitalLocation?.latitude ||
    incidentLocation?.latitude ||
    ambulanceLocation?.latitude ||
    13.0827;
  const centerLng =
    hospitalLocation?.longitude ||
    incidentLocation?.longitude ||
    ambulanceLocation?.longitude ||
    80.2707;

  // Generate Leaflet HTML
  const markers: MapCoordinate[] = [];
  if (ambulanceLocation) {
    markers.push({ ...ambulanceLocation, title: 'Ambulance Unit', type: 'ambulance' });
  }
  if (incidentLocation) {
    markers.push({ ...incidentLocation, title: incidentLocation.label || 'Incident Scene', type: 'incident' });
  }
  if (hospitalLocation) {
    markers.push({ ...hospitalLocation, title: hospitalLocation.label || 'Confirmed Hospital', type: 'hospital' });
  }

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: #F8FAFC; }
          #map { height: 100vh; width: 100vw; }
          .custom-pin {
            width: 24px; height: 24px; border-radius: 50%;
            border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 13);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
          }).addTo(map);

          const markers = ${JSON.stringify(markers)};
          const group = [];

          markers.forEach(m => {
            let color = '#2563EB';
            if (m.type === 'incident') color = '#DC2626';
            if (m.type === 'hospital') color = '#16A34A';

            const icon = L.divIcon({
              className: 'custom-marker',
              html: '<div style="background:' + color + '; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.4);"></div>',
              iconSize: [22, 22]
            });
            const marker = L.marker([m.latitude, m.longitude], { icon: icon })
              .bindPopup('<strong>' + m.title + '</strong>')
              .addTo(map);
            group.push([m.latitude, m.longitude]);
          });

          if (group.length > 1) {
            map.fitBounds(group, { padding: [30, 30] });
          }
        </script>
      </body>
    </html>
  `;

  const openExternalNavigation = () => {
    const dest = hospitalLocation || incidentLocation;
    if (!dest) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${dest.latitude},${dest.longitude}`,
      android: `google.navigation:q=${dest.latitude},${dest.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`,
    });
    Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`);
  };

  return (
    <View style={[styles.container, { height }]}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Tactical Map"
        />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webview}
          scrollEnabled={false}
        />
      )}

      {showNavigationButton && (hospitalLocation || incidentLocation) && (
        <TouchableOpacity
          style={styles.navButton}
          onPress={openExternalNavigation}
          activeOpacity={0.85}
        >
          <Navigation size={16} color="#FFFFFF" />
          <Text style={styles.navButtonText}>
            {hospitalLocation ? 'Navigate to Hospital' : 'Navigate to Scene'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borders,
    backgroundColor: Colors.mainBackground,
    position: 'relative',
    marginVertical: Spacing.sm,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  navButton: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
});
