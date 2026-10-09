import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LocationService } from '../../services/location';
import { StatusBadge } from '../../components/StatusBadge';
import { AppButton } from '../../components/AppButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  User as UserIcon,
  Ambulance as AmbulanceIcon,
  Phone,
  Mail,
  Shield,
  Radio,
  LogOut,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { AmbulanceStatus } from '../../types/ambulance';

const STATUS_CONFIG: {
  status: AmbulanceStatus;
  label: string;
  desc: string;
  badgeType: 'success' | 'warning' | 'neutral';
}[] = [
  {
    status: 'AVAILABLE',
    label: 'AVAILABLE',
    desc: 'Stationed & ready for immediate emergency dispatch',
    badgeType: 'success',
  },
  {
    status: 'BUSY',
    label: 'BUSY / RESPONDING',
    desc: 'Engaged in active field response or patient transport',
    badgeType: 'warning',
  },
  {
    status: 'OUT_OF_SERVICE',
    label: 'OUT OF SERVICE',
    desc: 'Unit offline for crew rest, refueling, or maintenance',
    badgeType: 'neutral',
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, ambulance, updateAvailability, logout, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [syncingGps, setSyncingGps] = useState(false);

  const handleStatusChange = async (newStatus: AmbulanceStatus) => {
    if (ambulance?.operational_status === newStatus) return;
    setUpdating(true);
    try {
      await updateAvailability(newStatus);
    } catch (e: any) {
      Alert.alert('Readiness Update Failed', e.message || 'Could not update operational status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSyncGpsNow = async () => {
    setSyncingGps(true);
    try {
      await LocationService.syncWithBackend();
      await refreshProfile();
      Alert.alert('GPS Synced', 'Vehicle telemetry coordinates successfully synced with dispatch CAD.');
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message || 'Could not synchronize live coordinates.');
    } finally {
      setSyncingGps(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out Unit', 'Are you sure you want to sign out this ambulance crew session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          LocationService.stopLiveTracking();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const cachedLoc = LocationService.getCachedLocation();
  const dispLat = ambulance?.latitude ?? cachedLoc?.latitude;
  const dispLng = ambulance?.longitude ?? cachedLoc?.longitude;
  const syncTimeStr = ambulance?.location_updated_at
    ? new Date(ambulance.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : cachedLoc?.timestamp
    ? new Date(cachedLoc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Not Synced';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Unit Readiness"
        subtitle="Ambulance & Paramedic Crew"
        rightAction={
          <TouchableOpacity onPress={() => refreshProfile()} style={{ padding: 4 }}>
            <RefreshCw size={18} color={Colors.primaryBlue} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Unit Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <AmbulanceIcon size={24} color={Colors.primaryBlue} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={Typography.h2}>
                {ambulance?.registration_identifier || 'Unit Not Assigned'}
              </Text>
              <Text style={Typography.bodySmall}>ERCS Emergency Fleet Unit</Text>
            </View>
            <StatusBadge
              label={ambulance?.operational_status || 'UNKNOWN'}
              type={
                ambulance?.operational_status === 'AVAILABLE'
                  ? 'success'
                  : ambulance?.operational_status === 'EN_ROUTE'
                  ? 'warning'
                  : 'neutral'
              }
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>OPERATIONAL READINESS STATUS</Text>
          <View style={styles.statusOptionsList}>
            {STATUS_CONFIG.map(({ status, label, desc, badgeType }) => {
              const isSelected = ambulance?.operational_status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOptionCard,
                    isSelected && styles.statusOptionCardActive,
                  ]}
                  onPress={() => handleStatusChange(status)}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  <View style={styles.statusOptionLeft}>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterActive,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.statusTextWrap}>
                      <Text
                        style={[
                          styles.statusTitle,
                          isSelected && styles.statusTitleActive,
                        ]}
                      >
                        {label}
                      </Text>
                      <Text style={styles.statusDesc}>{desc}</Text>
                    </View>
                  </View>
                  <StatusBadge label={status} type={badgeType} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Live GPS Telemetry Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.lightGreen }]}>
              <MapPin size={22} color={Colors.medicalGreen} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={Typography.h3}>GPS & Fleet Telemetry</Text>
              <Text style={Typography.caption}>Live Mobile Vehicle Transponder</Text>
            </View>
            <TouchableOpacity
              onPress={handleSyncGpsNow}
              disabled={syncingGps}
              style={styles.syncBtn}
            >
              <RefreshCw size={14} color={Colors.primaryBlue} />
              <Text style={styles.syncBtnText}>{syncingGps ? 'Syncing...' : 'Sync GPS'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MapPin size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Live Position:</Text>
            <Text style={styles.infoValue}>
              {dispLat && dispLng
                ? `${dispLat.toFixed(5)}, ${dispLng.toFixed(5)}`
                : 'Acquiring device signal...'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Radio size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>CAD Sync Time:</Text>
            <Text style={styles.infoValue}>{syncTimeStr}</Text>
          </View>
        </View>

        {/* Crew Info Card */}
        <View style={styles.card}>
          <Text style={Typography.h3}>Crew Credentials & Station</Text>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Mail size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Account Email:</Text>
            <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Shield size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Role Privilege:</Text>
            <Text style={styles.infoValue}>{user?.role || 'AMBULANCE_CREW'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Phone size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Direct Contact:</Text>
            <Text style={styles.infoValue}>
              {ambulance?.contact_number || 'None on file'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Radio size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Account Status:</Text>
            <StatusBadge label={user?.is_active ? 'VERIFIED' : 'PENDING'} type="success" />
          </View>
        </View>

        {/* Sign Out Button */}
        <AppButton
          title="Sign Out Ambulance Unit"
          onPress={handleLogout}
          variant="outline"
          icon={<LogOut size={18} color={Colors.error} />}
          textStyle={{ color: Colors.error }}
          style={styles.logoutButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borders,
    marginVertical: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  statusOptionsList: {
    gap: Spacing.sm,
  },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.borders,
    backgroundColor: '#FFFFFF',
  },
  statusOptionCardActive: {
    borderColor: Colors.primaryBlue,
    backgroundColor: Colors.lightBlue,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.secondaryText,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  radioOuterActive: {
    borderColor: Colors.primaryBlue,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.primaryBlue,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primaryText,
  },
  statusTitleActive: {
    color: Colors.primaryBlue,
  },
  statusDesc: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
    fontSize: 11,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.lightBlue,
  },
  syncBtnText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginLeft: Spacing.sm,
    width: 120,
  },
  infoValue: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    fontWeight: '600',
    flex: 1,
  },
  logoutButton: {
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginTop: Spacing.xs,
  },
});
