import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useEmergency } from '../../context/EmergencyContext';
import { StatusBadge } from '../../components/StatusBadge';
import { AppButton } from '../../components/AppButton';
import { LocationService, LocationCoordinates } from '../../services/location';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  Ambulance as AmbulanceIcon,
  PlusCircle,
  Radio,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Building2,
  MapPin,
  RefreshCw,
  Navigation,
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, ambulance, updateAvailability, refreshProfile } = useAuth();
  const {
    activeEmergency,
    confirmedHospital,
    refreshActiveEmergency,
    updateStatus,
    clearActiveEmergency,
  } = useEmergency();

  const [refreshing, setRefreshing] = useState(false);
  const [currentGps, setCurrentGps] = useState<LocationCoordinates | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Not synced');

  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0);

  // Sync GPS on mount and track while on duty
  const refreshGps = useCallback(async () => {
    setGpsLoading(true);
    try {
      const loc = await LocationService.getCurrentLocation();
      if (loc) {
        setCurrentGps(loc);
        await LocationService.syncWithBackend(loc);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.warn('GPS refresh failed:', e);
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGps();
    // Start continuous location tracking while in duty
    LocationService.startLiveTracking((coords) => {
      setCurrentGps(coords);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    });

    return () => {
      LocationService.stopLiveTracking();
    };
  }, [refreshGps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refreshActiveEmergency(), refreshGps()]);
    setRefreshing(false);
  };

  const isAvailable = ambulance?.operational_status === 'AVAILABLE';

  const toggleAvailability = async () => {
    if (!ambulance) return;
    const nextStatus = isAvailable ? 'BUSY' : 'AVAILABLE';
    await updateAvailability(nextStatus);
  };

  const freshness = LocationService.getFreshness(currentGps?.timestamp);

  return (
    <View style={styles.container}>
      {/* Safe Area Top Header */}
      <View style={[styles.header, { paddingTop: safeTop + 10 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.unitBadge}>
            <AmbulanceIcon size={18} color={Colors.primaryBlue} />
            <Text style={styles.unitText}>
              {ambulance ? ambulance.registration_identifier : 'Unit Loading...'}
            </Text>
          </View>
          <Text style={styles.crewEmail} numberOfLines={1}>
            {user?.email || 'Authenticated Crew'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.statusToggle, isAvailable ? styles.statusAvail : styles.statusBusy]}
          onPress={toggleAvailability}
          activeOpacity={0.8}
        >
          <Radio size={13} color={isAvailable ? Colors.medicalGreen : Colors.warning} />
          <Text
            style={[
              styles.statusToggleText,
              { color: isAvailable ? Colors.medicalGreen : Colors.warning },
            ]}
          >
            {ambulance?.operational_status || 'UNKNOWN'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live GPS Telemetry Status Banner */}
        <View style={styles.gpsCard}>
          <View style={styles.gpsRow}>
            <View style={styles.gpsIndicator}>
              <View
                style={[
                  styles.gpsDot,
                  {
                    backgroundColor:
                      freshness === 'LIVE'
                        ? Colors.medicalGreen
                        : freshness === 'RECENT'
                        ? Colors.primaryBlue
                        : Colors.warning,
                  },
                ]}
              />
              <Text style={styles.gpsLabel}>GPS Telemetry:</Text>
              <Text style={styles.gpsStatusValue}>{freshness}</Text>
            </View>

            <TouchableOpacity
              style={styles.gpsRefreshBtn}
              onPress={refreshGps}
              disabled={gpsLoading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw
                size={14}
                color={Colors.primaryBlue}
                style={gpsLoading ? { opacity: 0.5 } : undefined}
              />
              <Text style={styles.gpsRefreshText}>{gpsLoading ? 'Acquiring...' : 'Sync GPS'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gpsCoordsRow}>
            <MapPin size={14} color={Colors.secondaryText} />
            <Text style={styles.coordsText}>
              {currentGps
                ? `${currentGps.latitude.toFixed(5)}, ${currentGps.longitude.toFixed(5)}`
                : ambulance?.latitude && ambulance?.longitude
                ? `${ambulance.latitude.toFixed(5)}, ${ambulance.longitude.toFixed(5)} (Server)`
                : 'Acquiring device satellite coordinates...'}
            </Text>
            <Text style={styles.syncTimestampText}>• Last: {lastSyncTime}</Text>
          </View>
        </View>

        {/* ACTIVE MISSION CARD (If present) */}
        {activeEmergency ? (
          <View style={styles.activeCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.missionTitleBox}>
                <View style={styles.pingDot} />
                <Text style={styles.activeCardTitle}>ACTIVE EMERGENCY</Text>
              </View>
            </View>
            <View style={styles.missionDetailRow}>
              <Text style={Typography.bodySmall}>Status:</Text>
              <StatusBadge
                label={activeEmergency.status.replace(/_/g, ' ')}
                type={
                  activeEmergency.status === 'HOSPITAL_ASSIGNED'
                    ? 'success'
                    : activeEmergency.status === 'CREATED'
                    ? 'warning'
                    : 'info'
                }
              />
            </View>

            <View style={styles.missionDetailRow}>
              <Text style={Typography.bodySmall}>Incident ID:</Text>
              <Text style={Typography.mono}>#{activeEmergency.id.slice(0, 8)}</Text>
            </View>

            <View style={styles.missionDetailRow}>
              <Text style={Typography.bodySmall}>Priority:</Text>
              <StatusBadge
                label={activeEmergency.severity_level || activeEmergency.incident_type || 'CRITICAL'}
                type={
                  activeEmergency.severity_level === 'CRITICAL' ? 'error' : 'warning'
                }
              />
            </View>

            {(activeEmergency.location_description || activeEmergency.incident_description) && (
              <View style={styles.locationSnippet}>
                <MapPin size={15} color={Colors.primaryBlue} />
                <Text style={[Typography.bodySmall, { marginLeft: 6, flex: 1, color: Colors.primaryText }]}>
                  {activeEmergency.location_description || activeEmergency.incident_description}
                </Text>
              </View>
            )}

            {/* Confirmed destination display if assigned */}
            {confirmedHospital ? (
              <View style={styles.confirmedBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Building2 size={18} color={Colors.medicalGreen} />
                  <Text style={styles.confirmedHospitalName}>{confirmedHospital.name}</Text>
                </View>
                <Text style={[Typography.caption, { marginTop: 3, color: Colors.secondaryText }]}>
                  {confirmedHospital.address}
                </Text>
              </View>
            ) : (
              <View style={styles.matchingBox}>
                <Clock size={15} color={Colors.warning} />
                <Text style={styles.matchingText}>
                  Dispatch matching in progress with nearby emergency hospitals...
                </Text>
              </View>
            )}

            <AppButton
              title="Open Incident Operations"
              onPress={() => router.push('/emergency/active')}
              style={{ marginTop: Spacing.md }}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
            />

            <TouchableOpacity
              style={{
                marginTop: Spacing.sm,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: Colors.borders,
                backgroundColor: '#FFF1F2',
              }}
              onPress={() => {
                Alert.alert(
                  'Conclude Active Incident',
                  'Are you sure you want to conclude and clear this active incident from this unit?',
                  [
                    { text: 'Keep Active', style: 'cancel' },
                    {
                      text: 'Conclude & Clear',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await updateStatus('CANCELLED' as any, 'Concluded by crew from home');
                        } catch {
                          clearActiveEmergency();
                        }
                        refreshActiveEmergency();
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={{ color: Colors.error, fontSize: 13, fontWeight: '700' }}>
                Conclude / Clear Incident
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* NO ACTIVE EMERGENCY — READY STATE */
          <View style={styles.readyCard}>
            <View style={styles.readyHeader}>
              <CheckCircle2 size={30} color={Colors.medicalGreen} />
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <Text style={Typography.h3}>Unit Stationed & Ready</Text>
                <Text style={Typography.caption}>
                  Logged into RESQ fleet. Awaiting field dispatch or call-in.
                </Text>
              </View>
            </View>

            <View style={styles.ctaContainer}>
              <AppButton
                title="START EMERGENCY"
                onPress={() => router.push('/emergency/create')}
                variant="emergency"
                icon={<PlusCircle size={20} color="#FFFFFF" />}
                style={styles.ctaButton}
              />
            </View>
          </View>
        )}

        {/* Field Operations Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Field Operations</Text>
        </View>

        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: Colors.lightBlue }]}>
              <Clock size={20} color={Colors.primaryBlue} />
            </View>
            <Text style={styles.shortcutTitle}>Shift History</Text>
            <Text style={Typography.caption}>Review completed handovers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: Colors.lightGreen }]}>
              <Shield size={20} color={Colors.medicalGreen} />
            </View>
            <Text style={styles.shortcutTitle}>Unit Readiness</Text>
            <Text style={Typography.caption}>Manage vehicle & status</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitText: {
    ...Typography.h3,
    fontSize: 16,
    color: Colors.darkNavy,
    marginLeft: 6,
  },
  crewEmail: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 1,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  statusAvail: {
    backgroundColor: Colors.lightGreen,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  statusBusy: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  statusToggleText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  gpsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsLabel: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontWeight: '600',
  },
  gpsStatusValue: {
    ...Typography.caption,
    color: Colors.darkNavy,
    fontWeight: '700',
  },
  gpsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsRefreshText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  gpsCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  coordsText: {
    ...Typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: Colors.primaryText,
    fontSize: 11,
  },
  syncTimestampText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontSize: 10,
  },
  activeCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.primaryBlue,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  missionTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    marginRight: 6,
  },
  activeCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.error,
    letterSpacing: 0.5,
  },
  missionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  locationSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBlue,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  confirmedBox: {
    backgroundColor: Colors.lightGreen,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  confirmedHospitalName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.medicalGreen,
    marginLeft: 6,
  },
  matchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  matchingText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
    flex: 1,
  },
  readyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borders,
    marginBottom: Spacing.lg,
    ...Shadows.subtle,
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  ctaContainer: {
    marginTop: Spacing.xs,
  },
  ctaButton: {
    height: 52,
    borderRadius: BorderRadius.md,
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
  },
  shortcutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  shortcutTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.darkNavy,
  },
});
