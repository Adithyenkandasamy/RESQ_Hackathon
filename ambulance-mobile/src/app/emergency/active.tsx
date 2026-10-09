import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEmergency } from '../../context/EmergencyContext';
import { EmergencyStatus } from '../../types/emergency';
import { StatusBadge } from '../../components/StatusBadge';
import { AppButton } from '../../components/AppButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  Building2,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react-native';

function getNextAction(status: EmergencyStatus): {
  targetStatus: EmergencyStatus;
  label: string;
  isHandover?: boolean;
} | null {
  switch (status) {
    case 'CREATED':
    case 'MATCHING_IN_PROGRESS':
    case 'HOSPITAL_ASSIGNED':
    case 'DISPATCHED':
      return { targetStatus: 'EN_ROUTE_SCENE', label: 'Mark En Route to Scene' };
    case 'EN_ROUTE_SCENE':
      return { targetStatus: 'ON_SCENE', label: 'Mark On Scene with Patient' };
    case 'ON_SCENE':
      return { targetStatus: 'EN_ROUTE_HOSPITAL', label: 'Begin Transport to Hospital' };
    case 'EN_ROUTE_HOSPITAL':
      return { targetStatus: 'AT_HOSPITAL', label: 'Record Hospital Arrival' };
    case 'AT_HOSPITAL':
      return { targetStatus: 'HANDOVER_COMPLETED', label: 'Complete Patient Handover', isHandover: true };
    default:
      return null;
  }
}

export default function ActiveEmergencyScreen() {
  const router = useRouter();
  const {
    activeEmergency,
    confirmedHospital,
    refreshActiveEmergency,
    updateStatus,
    completeHandover,
    clearActiveEmergency,
  } = useEmergency();
  const [updating, setUpdating] = useState(false);

  if (!activeEmergency) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mission Active" canGoBack />
        <View style={styles.emptyBox}>
          <AlertCircle size={48} color={Colors.secondaryText} />
          <Text style={Typography.h3}>No Active Incident</Text>
          <Text style={Typography.bodySmall}>
            Return to dashboard to initiate or receive an emergency dispatch.
          </Text>
          <AppButton
            title="Return to Dashboard"
            onPress={() => router.replace('/(tabs)/home')}
            style={{ marginTop: Spacing.base }}
          />
        </View>
      </View>
    );
  }

  const nextAction = getNextAction(activeEmergency.status);

  const handleNextAction = async () => {
    if (!nextAction) return;
    if (nextAction.isHandover) {
      router.push('/emergency/handover');
      return;
    }

    setUpdating(true);
    try {
      await updateStatus(nextAction.targetStatus);
    } catch (e: any) {
      Alert.alert('Status Transition Error', e.message || 'Invalid transition state.');
    } finally {
      setUpdating(false);
    }
  };

  const openNavigation = () => {
    const dest = confirmedHospital || (activeEmergency.latitude ? { latitude: activeEmergency.latitude, longitude: activeEmergency.longitude } : null);
    if (!dest) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${dest.latitude},${dest.longitude}`,
      android: `google.navigation:q=${dest.latitude},${dest.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`,
    });
    Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`Incident #${activeEmergency.id.slice(0, 8)}`}
        subtitle={activeEmergency.status.replace(/_/g, ' ')}
        canGoBack
        rightAction={
          <TouchableOpacity onPress={() => refreshActiveEmergency()} style={{ padding: 4 }}>
            <RefreshCw size={18} color={Colors.primaryBlue} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Primary Next Status Action Button */}
        {nextAction && (
          <View style={styles.nextActionContainer}>
            <AppButton
              title={nextAction.label}
              onPress={handleNextAction}
              loading={updating}
              icon={<ArrowRight size={20} color="#FFFFFF" />}
              style={styles.primaryActionButton}
            />
          </View>
        )}

        {/* Confirmed Hospital or Matching Notice */}
        {confirmedHospital ? (
          <View style={styles.hospitalCard}>
            <View style={styles.hospitalHeader}>
              <View style={styles.hospIconBox}>
                <Building2 size={24} color={Colors.medicalGreen} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={Typography.h3}>{confirmedHospital.name}</Text>
                <Text style={Typography.bodySmall}>{confirmedHospital.address}</Text>
              </View>
              <StatusBadge label="CONFIRMED" type="success" />
            </View>

            {confirmedHospital.contact_number && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL(`tel:${confirmedHospital.contact_number}`)}
              >
                <Phone size={15} color={Colors.primaryBlue} />
                <Text style={styles.phoneText}>{confirmedHospital.contact_number}</Text>
              </TouchableOpacity>
            )}

            <AppButton
              title="Open Google Maps GPS Navigation"
              onPress={openNavigation}
              icon={<Navigation size={18} color="#FFFFFF" />}
              style={styles.navButton}
            />
          </View>
        ) : (
          <View style={styles.matchingNotice}>
            <Clock size={20} color={Colors.warning} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={[Typography.bodySmall, { color: Colors.warning, fontWeight: '700' }]}>
                Awaiting Hospital Acceptance
              </Text>
              <Text style={[Typography.caption, { color: Colors.warning, marginTop: 2 }]}>
                Hospital matching requests sent to qualified facilities.
              </Text>
            </View>
          </View>
        )}

        {/* Patient Delivered / Admitted Button */}
        <TouchableOpacity
          style={{
            marginTop: Spacing.lg,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: BorderRadius.md,
            backgroundColor: Colors.medicalGreen,
            flexDirection: 'row',
            gap: 8,
          }}
          onPress={() => {
            Alert.alert(
              'Complete Hospital Handover',
              'Confirm that the patient has been delivered and admitted to the hospital. This will close this mission.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Admitted',
                  style: 'default',
                  onPress: async () => {
                    try {
                      await completeHandover('Patient delivered and admitted to hospital by crew.');
                    } catch {
                      try {
                        await updateStatus('HANDOVER_COMPLETED' as any, 'Patient admitted to hospital.');
                      } catch {
                        clearActiveEmergency();
                      }
                    }
                    router.replace('/(tabs)/home');
                  },
                },
              ]
            );
          }}
        >
          <CheckCircle2 size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
            Patient Reached — Complete
          </Text>
        </TouchableOpacity>

        {/* Cancel Mission */}
        <TouchableOpacity
          style={{ marginTop: Spacing.md, alignItems: 'center', paddingVertical: 8 }}
          onPress={() => {
            Alert.alert(
              'Cancel Mission',
              'Are you sure you want to cancel this emergency mission?',
              [
                { text: 'Keep Active', style: 'cancel' },
                {
                  text: 'Cancel Mission',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await updateStatus('CANCELLED' as any, 'Cancelled by crew');
                    } catch {
                      clearActiveEmergency();
                    }
                    router.replace('/(tabs)/home');
                  },
                },
              ]
            );
          }}
        >
          <Text style={{ color: Colors.secondaryText, fontSize: 12, fontWeight: '600' }}>
            Cancel Mission
          </Text>
        </TouchableOpacity>
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
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginTop: 60,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    marginBottom: Spacing.md,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.borders,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleCompleted: {
    backgroundColor: Colors.medicalGreen,
  },
  stepCircleCurrent: {
    backgroundColor: Colors.primaryBlue,
  },
  stepNum: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.secondaryText,
    fontSize: 11,
  },
  stepNumActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.secondaryText,
  },
  stepLabelCurrent: {
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  nextActionContainer: {
    marginBottom: Spacing.md,
  },
  primaryActionButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryBlue,
  },
  hospitalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.medicalGreen,
    ...Shadows.card,
    marginBottom: Spacing.md,
  },
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hospIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: 4,
  },
  phoneText: {
    ...Typography.bodySmall,
    color: Colors.primaryBlue,
    marginLeft: 6,
    fontWeight: '600',
  },
  navButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.medicalGreen,
  },
  matchingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: BorderRadius.base,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    alignItems: 'center',
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  actionTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    textAlign: 'center',
  },
  patientConditionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    ...Shadows.card,
    marginBottom: Spacing.md,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conditionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  conditionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapseBtn: {
    padding: 2,
  },
  collapsedHint: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.mainBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borders,
  },
  collapsedHintText: {
    ...Typography.caption,
    color: Colors.secondaryText,
  },
  conditionTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.darkNavy,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  conditionHint: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginBottom: Spacing.sm,
  },
  conditionInput: {
    backgroundColor: Colors.mainBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Colors.primaryText,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  conditionActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.lightBlue,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    gap: 6,
  },
  voiceBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  recordingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    gap: 6,
  },
  recordingBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sendNoteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryBlue,
    gap: 6,
  },
  sendNoteBtnDisabled: {
    opacity: 0.5,
  },
  sendNoteBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
