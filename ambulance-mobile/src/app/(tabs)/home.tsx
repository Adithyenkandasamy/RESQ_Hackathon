import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useEmergency } from '../../context/EmergencyContext';
import { StatusBadge } from '../../components/StatusBadge';
import { AppButton } from '../../components/AppButton';
import { MapViewComponent } from '../../components/MapViewComponent';
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
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user, ambulance, updateAvailability, refreshProfile } = useAuth();
  const { activeEmergency, confirmedHospital, isLoading, refreshActiveEmergency } = useEmergency();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refreshActiveEmergency()]);
    setRefreshing(false);
  };

  const isAvailable = ambulance?.operational_status === 'AVAILABLE';

  const toggleAvailability = async () => {
    if (!ambulance) return;
    const nextStatus = isAvailable ? 'BUSY' : 'AVAILABLE';
    await updateAvailability(nextStatus);
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.unitBadge}>
            <AmbulanceIcon size={18} color={Colors.primaryBlue} />
            <Text style={styles.unitText}>
              {ambulance ? ambulance.registration_identifier : 'Unit Loading'}
            </Text>
          </View>
          <Text style={styles.crewEmail} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.statusToggle, isAvailable ? styles.statusAvail : styles.statusOff]}
          onPress={toggleAvailability}
          activeOpacity={0.8}
        >
          <Radio size={14} color={isAvailable ? Colors.medicalGreen : Colors.secondaryText} />
          <Text
            style={[
              styles.statusToggleText,
              { color: isAvailable ? Colors.medicalGreen : Colors.secondaryText },
            ]}
          >
            {ambulance?.operational_status || 'UNKNOWN'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ACTIVE MISSION CARD (If present) */}
        {activeEmergency ? (
          <View style={styles.activeCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.missionTitleBox}>
                <View style={styles.pingDot} />
                <Text style={styles.activeCardTitle}>ACTIVE EMERGENCY IN PROGRESS</Text>
              </View>
              <StatusBadge
                label={activeEmergency.status}
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
              <Text style={Typography.mono}>{activeEmergency.id.slice(0, 8)}</Text>
            </View>

            <View style={styles.missionDetailRow}>
              <Text style={Typography.bodySmall}>Severity:</Text>
              <StatusBadge
                label={activeEmergency.severity_level}
                type={activeEmergency.severity_level === 'CRITICAL' ? 'error' : 'warning'}
              />
            </View>

            {activeEmergency.location_description && (
              <View style={styles.locationSnippet}>
                <MapPin size={16} color={Colors.secondaryText} />
                <Text style={[Typography.bodySmall, { marginLeft: 6, flex: 1 }]}>
                  {activeEmergency.location_description}
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
                <Text style={[Typography.bodySmall, { marginTop: 4 }]}>
                  {confirmedHospital.address}
                </Text>
              </View>
            ) : (
              <View style={styles.matchingBox}>
                <Clock size={16} color={Colors.warning} />
                <Text style={styles.matchingText}>
                  Hospital dispatch matching in progress with triage centers...
                </Text>
              </View>
            )}

            {/* Mini Tactical Map */}
            {activeEmergency.latitude && activeEmergency.longitude && (
              <MapViewComponent
                incidentLocation={{
                  latitude: activeEmergency.latitude,
                  longitude: activeEmergency.longitude,
                  label: 'Incident Scene',
                }}
                hospitalLocation={
                  confirmedHospital && confirmedHospital.latitude && confirmedHospital.longitude
                    ? {
                        latitude: confirmedHospital.latitude,
                        longitude: confirmedHospital.longitude,
                        label: confirmedHospital.name,
                      }
                    : null
                }
                height={160}
              />
            )}

            <AppButton
              title="Open Incident Operations"
              onPress={() => router.push('/emergency/active')}
              style={{ marginTop: Spacing.md }}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
            />
          </View>
        ) : (
          /* NO ACTIVE EMERGENCY — SHOW PRIMARY CTA */
          <View style={styles.readyCard}>
            <View style={styles.readyHeader}>
              <CheckCircle2 size={32} color={Colors.medicalGreen} />
              <View style={{ marginLeft: Spacing.md }}>
                <Text style={Typography.h2}>Unit Ready for Dispatch</Text>
                <Text style={Typography.bodySmall}>
                  Stationed and awaiting emergency field incident assignment.
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

        {/* Quick Operational Shortcuts */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.h3}>Field Operations</Text>
        </View>

        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: Colors.lightBlue }]}>
              <Clock size={22} color={Colors.primaryBlue} />
            </View>
            <Text style={styles.shortcutTitle}>Shift History</Text>
            <Text style={Typography.bodySmall}>Review past dispatches and handovers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: Colors.lightGreen }]}>
              <Shield size={22} color={Colors.medicalGreen} />
            </View>
            <Text style={styles.shortcutTitle}>Unit Readiness</Text>
            <Text style={Typography.bodySmall}>Manage operational state & vehicle details</Text>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
    gap: 6,
  },
  unitText: {
    ...Typography.h3,
    color: Colors.darkNavy,
  },
  crewEmail: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusAvail: {
    backgroundColor: Colors.lightGreen,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  statusOff: {
    backgroundColor: '#F1F5F9',
    borderColor: Colors.borders,
  },
  statusToggleText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.base,
  },
  activeCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.primaryBlue,
    ...Shadows.card,
    marginBottom: Spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  missionTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
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
    marginBottom: Spacing.xs,
  },
  locationSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.xs,
  },
  confirmedBox: {
    backgroundColor: Colors.lightGreen,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  confirmedHospitalName: {
    ...Typography.h3,
    color: Colors.medicalGreen,
    marginLeft: 6,
  },
  matchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  matchingText: {
    ...Typography.caption,
    color: Colors.warning,
    flex: 1,
  },
  readyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.card,
    marginBottom: Spacing.lg,
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  ctaContainer: {
    marginTop: Spacing.sm,
  },
  ctaButton: {
    height: 52,
    ...Shadows.elevated,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
  },
  shortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  shortcutTitle: {
    ...Typography.h3,
    marginBottom: 2,
  },
});
