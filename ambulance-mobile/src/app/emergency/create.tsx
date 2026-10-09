import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEmergency } from '../../context/EmergencyContext';
import { LocationService } from '../../services/location';
import { EmergencySeverity } from '../../types/emergency';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  MapPin,
  RefreshCw,
  X,
  AlertTriangle,
  Flame,
  Clock,
  HeartPulse,
} from 'lucide-react-native';

const PRESET_EMERGENCIES = [
  'Cardiac Arrest / Chest Pain',
  'Severe Trauma / Accident',
  'Acute Respiratory Distress',
  'Suspected Stroke',
  'Unresponsive / Loss of Consciousness',
];

const PATIENT_PRESETS = ['Male Adult', 'Female Adult', 'Child / Pediatric', 'Unknown'];

export default function CreateEmergencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createEmergency } = useEmergency();

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Read cached GPS from continuous tracking service
  const initialLoc = LocationService.getCachedLocation();

  // Minimal Emergency Fields
  const [severity, setSeverity] = useState<EmergencySeverity>('CRITICAL');
  const [chiefComplaint, setChiefComplaint] = useState('Cardiac Arrest / Chest Pain');
  const [patientDemographic, setPatientDemographic] = useState('Unknown');

  // Ambulance Device Location (Physical Vehicle)
  const [ambulanceLat, setAmbulanceLat] = useState<number | null>(initialLoc?.latitude ?? null);
  const [ambulanceLng, setAmbulanceLng] = useState<number | null>(initialLoc?.longitude ?? null);

  // Incident Scene Location (Where Emergency Occurred)
  const [incidentAtAmbulanceLocation, setIncidentAtAmbulanceLocation] = useState(true);
  const [sceneAddress, setSceneAddress] = useState('');
  const [sceneLat, setSceneLat] = useState<number | null>(initialLoc?.latitude ?? null);
  const [sceneLng, setSceneLng] = useState<number | null>(initialLoc?.longitude ?? null);
  const [locationLabel, setLocationLabel] = useState(
    initialLoc
      ? `${initialLoc.latitude.toFixed(4)}, ${initialLoc.longitude.toFixed(4)}`
      : 'Acquiring GPS...'
  );

  // Auto-acquire fresh GPS coordinates on mount
  useEffect(() => {
    fetchCurrentGPS();
  }, []);

  const fetchCurrentGPS = async () => {
    setGpsLoading(true);
    try {
      const loc = await LocationService.getCurrentLocation();
      if (loc && LocationService.isValidCoordinate(loc.latitude, loc.longitude)) {
        setAmbulanceLat(loc.latitude);
        setAmbulanceLng(loc.longitude);
        if (incidentAtAmbulanceLocation) {
          setSceneLat(loc.latitude);
          setSceneLng(loc.longitude);
          setLocationLabel(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
        }
      } else {
        setLocationLabel('GPS signal unavailable');
      }
    } catch {
      setLocationLabel('GPS signal unavailable');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleToggleSceneLocation = (atAmbulance: boolean) => {
    setIncidentAtAmbulanceLocation(atAmbulance);
    if (atAmbulance) {
      setSceneLat(ambulanceLat);
      setSceneLng(ambulanceLng);
    } else {
      setSceneLat(null);
      setSceneLng(null);
    }
  };

  const handleDispatch = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const capabilities: string[] = [];
      if (severity === 'CRITICAL') {
        capabilities.push('trauma_center', 'icu');
      }

      const finalLat = incidentAtAmbulanceLocation ? sceneLat : sceneLat;
      const finalLng = incidentAtAmbulanceLocation ? sceneLng : sceneLng;
      const sceneDesc = incidentAtAmbulanceLocation
        ? (sceneAddress.trim() ? `${sceneAddress.trim()} (at unit GPS)` : `Scene @ ${locationLabel}`)
        : (sceneAddress.trim() || 'Field Emergency Scene (coordinates pending)');

      await createEmergency({
        severity_level: severity,
        location_description: sceneDesc,
        incident_latitude: finalLat ?? undefined,
        incident_longitude: finalLng ?? undefined,
        required_capabilities: capabilities,
        patient_info: {
          chief_complaint: chiefComplaint.trim() || 'Acute emergency',
          gender: patientDemographic.includes('Female') ? 'Female' : patientDemographic.includes('Male') ? 'Male' : undefined,
          transport_priority: severity,
        },
      });

      router.replace('/emergency/active');
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort') || err?.status === 499) {
        router.replace('/emergency/active');
        return;
      }
      Alert.alert('Dispatch Failed', err.message || 'Could not dispatch emergency to backend.');
    } finally {
      setLoading(false);
    }
  };

  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0);
  const safeBottom = Math.max(insets.bottom, Spacing.base);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fixedScreen}
    >
      {/* Top Header with Safe Area Inset */}
      <View style={[styles.topHeader, { paddingTop: safeTop + 10 }]}>
        <View>
          <Text style={styles.screenTitle}>Rapid Emergency Dispatch</Text>
          <Text style={styles.screenSubtitle}>Instant 1-Tap Hospital Coordination</Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Incident Scene Location Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INCIDENT SCENE LOCATION</Text>
          <View style={styles.locationToggleRow}>
            <TouchableOpacity
              style={[
                styles.locToggleBtn,
                incidentAtAmbulanceLocation && styles.locToggleBtnActive,
              ]}
              onPress={() => handleToggleSceneLocation(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.locToggleText,
                  incidentAtAmbulanceLocation && styles.locToggleTextActive,
                ]}
              >
                At Unit Position
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.locToggleBtn,
                !incidentAtAmbulanceLocation && styles.locToggleBtnActive,
              ]}
              onPress={() => handleToggleSceneLocation(false)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.locToggleText,
                  !incidentAtAmbulanceLocation && styles.locToggleTextActive,
                ]}
              >
                Different Location / Address
              </Text>
            </TouchableOpacity>
          </View>

          {incidentAtAmbulanceLocation ? (
            <View style={styles.gpsBar}>
              <View style={styles.gpsLeft}>
                <MapPin size={16} color={Colors.primaryBlue} />
                <Text style={styles.gpsText} numberOfLines={1}>
                  Unit GPS: {locationLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.gpsRefreshBtn}
                onPress={fetchCurrentGPS}
                disabled={gpsLoading}
              >
                <RefreshCw size={14} color={Colors.primaryBlue} />
                <Text style={styles.gpsRefreshText}>{gpsLoading ? 'Locating...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: Spacing.xs }}>
              <AppInput
                placeholder="Enter scene address, junction, or landmark..."
                value={sceneAddress}
                onChangeText={setSceneAddress}
                style={styles.inputField}
              />
              <Text style={[Typography.caption, { color: Colors.secondaryText, marginTop: 4 }]}>
                {sceneLat && sceneLng
                  ? `Scene Coords: ${sceneLat.toFixed(4)}, ${sceneLng.toFixed(4)}`
                  : 'Coordinates: Unrecorded (text location will be used)'}
              </Text>
            </View>
          )}
        </View>

        {/* 1-Tap Severity Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRIAGE PRIORITY</Text>
          <View style={styles.severityRow}>
            <TouchableOpacity
              style={[
                styles.severityBtn,
                styles.severityCritical,
                severity === 'CRITICAL' && styles.severityCriticalActive,
              ]}
              onPress={() => setSeverity('CRITICAL')}
              activeOpacity={0.8}
            >
              <Flame
                size={18}
                color={severity === 'CRITICAL' ? '#FFFFFF' : Colors.error}
              />
              <Text
                style={[
                  styles.severityText,
                  { color: severity === 'CRITICAL' ? '#FFFFFF' : Colors.error },
                ]}
              >
                CRITICAL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.severityBtn,
                styles.severityUrgent,
                severity === 'URGENT' && styles.severityUrgentActive,
              ]}
              onPress={() => setSeverity('URGENT')}
              activeOpacity={0.8}
            >
              <AlertTriangle
                size={18}
                color={severity === 'URGENT' ? '#FFFFFF' : Colors.warning}
              />
              <Text
                style={[
                  styles.severityText,
                  { color: severity === 'URGENT' ? '#FFFFFF' : Colors.warning },
                ]}
              >
                URGENT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.severityBtn,
                styles.severityStandard,
                severity === 'STANDARD' && styles.severityStandardActive,
              ]}
              onPress={() => setSeverity('STANDARD')}
              activeOpacity={0.8}
            >
              <Clock
                size={18}
                color={severity === 'STANDARD' ? '#FFFFFF' : Colors.primaryBlue}
              />
              <Text
                style={[
                  styles.severityText,
                  { color: severity === 'STANDARD' ? '#FFFFFF' : Colors.primaryBlue },
                ]}
              >
                STANDARD
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chief Complaint & Quick Chips */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHIEF COMPLAINT / INCIDENT</Text>
          <View style={styles.chipsContainer}>
            {PRESET_EMERGENCIES.map((preset) => {
              const isSelected = chiefComplaint === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setChiefComplaint(preset)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppInput
            placeholder="Or type specific notes (e.g. Unconscious at junction)"
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            style={styles.inputField}
          />
        </View>

        {/* Patient Demographic (Quick Chips) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PATIENT DEMOGRAPHIC (OPTIONAL)</Text>
          <View style={styles.chipsRow}>
            {PATIENT_PRESETS.map((demo) => {
              const isSelected = patientDemographic === demo;
              return (
                <TouchableOpacity
                  key={demo}
                  style={[styles.smallChip, isSelected && styles.smallChipActive]}
                  onPress={() => setPatientDemographic(demo)}
                >
                  <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                    {demo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Pinned Bottom Dispatch Action */}
      <View style={[styles.bottomBar, { paddingBottom: safeBottom }]}>
        <AppButton
          title={loading ? 'DISPATCHING TO HOSPITALS...' : 'DISPATCH EMERGENCY NOW'}
          onPress={handleDispatch}
          loading={loading}
          variant="emergency"
          icon={<HeartPulse size={22} color="#FFFFFF" />}
          style={styles.dispatchButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fixedScreen: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
  },
  screenTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.darkNavy,
  },
  screenSubtitle: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.mainBackground,
  },
  contentContainer: {
    padding: Spacing.base,
  },
  locationToggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  locToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borders,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locToggleBtnActive: {
    borderColor: Colors.primaryBlue,
    backgroundColor: Colors.lightBlue,
  },
  locToggleText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontWeight: '600',
  },
  locToggleTextActive: {
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.lightBlue,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gpsText: {
    ...Typography.bodySmall,
    color: Colors.primaryBlue,
    fontWeight: '600',
    marginLeft: Spacing.xs,
    flex: 1,
  },
  gpsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  gpsRefreshText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '700',
    marginLeft: 4,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  severityRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  severityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 6,
  },
  severityCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  severityCriticalActive: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  severityUrgent: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  severityUrgentActive: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  severityStandard: {
    backgroundColor: Colors.lightBlue,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  severityStandardActive: {
    backgroundColor: Colors.primaryBlue,
    borderColor: Colors.primaryBlue,
  },
  severityText: {
    ...Typography.button,
    fontSize: 13,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.cardBackground,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borders,
  },
  chipActive: {
    backgroundColor: Colors.lightBlue,
    borderColor: Colors.primaryBlue,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.primaryText,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  inputField: {
    marginTop: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borders,
  },
  smallChipActive: {
    backgroundColor: Colors.lightGreen,
    borderColor: Colors.medicalGreen,
  },
  smallChipText: {
    ...Typography.caption,
    color: Colors.primaryText,
    fontWeight: '500',
    fontSize: 11,
  },
  smallChipTextActive: {
    color: Colors.medicalGreen,
    fontWeight: '700',
  },
  bottomBar: {
    padding: Spacing.base,
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.borders,
    ...Shadows.card,
  },
  dispatchButton: {
    height: 52,
    borderRadius: BorderRadius.md,
  },
});
