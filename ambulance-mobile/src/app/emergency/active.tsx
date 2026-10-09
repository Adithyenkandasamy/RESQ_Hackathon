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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEmergency } from '../../context/EmergencyContext';
import { LocationService } from '../../services/location';
import { EmergenciesApi } from '../../api/emergencies';
import { MediaService } from '../../services/media';
import { SecureStorageService } from '../../services/secureStorage';
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
  Mic,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Activity,
  Send,
  Square,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';

const STATUS_STEPS: { key: EmergencyStatus; label: string }[] = [
  { key: 'EN_ROUTE_SCENE', label: 'En Route' },
  { key: 'ON_SCENE', label: 'On Scene' },
  { key: 'EN_ROUTE_HOSPITAL', label: 'Transport' },
  { key: 'AT_HOSPITAL', label: 'Arrived' },
];

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
  } = useEmergency();
  const [updating, setUpdating] = useState(false);
  const [patientNote, setPatientNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [recordTimer, setRecordTimer] = useState<any>(null);
  const [patientCardCollapsed, setPatientCardCollapsed] = useState(false);

  React.useEffect(() => {
    if (activeEmergency) {
      const existing =
        (activeEmergency.patient_info?.condition_description as string) ||
        activeEmergency.incident_description ||
        '';
      setPatientNote(existing);
    }
    SecureStorageService.getPatientNotesCollapsed()
      .then(setPatientCardCollapsed)
      .catch(() => {});
  }, [activeEmergency?.id]);

  const togglePatientCard = async () => {
    const next = !patientCardCollapsed;
    setPatientCardCollapsed(next);
    await SecureStorageService.setPatientNotesCollapsed(next);
  };

  const startVoiceNote = async () => {
    const started = await MediaService.startAudioRecording();
    if (started) {
      setIsRecording(true);
      setRecordDuration(0);
      const timer = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
      setRecordTimer(timer);
    } else {
      Alert.alert('Microphone Error', 'Could not access device microphone.');
    }
  };

  const stopVoiceNote = async () => {
    if (!activeEmergency) return;
    if (recordTimer) {
      clearInterval(recordTimer);
      setRecordTimer(null);
    }
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const result = await MediaService.stopAudioRecording();
      if (result) {
        const res = await EmergenciesApi.uploadAudio(activeEmergency.id, {
          uri: result.uri,
          name: 'patient_voice_note.m4a',
          type: 'audio/m4a',
        });
        if (res.transcription_text) {
          const appended = patientNote
            ? `${patientNote}\n[Voice]: ${res.transcription_text}`
            : res.transcription_text;
          setPatientNote(appended);
          await EmergenciesApi.updatePatientInfo(activeEmergency.id, {
            ...activeEmergency.patient_info,
            condition_description: appended,
          });
          await refreshActiveEmergency();
          Alert.alert('Voice Note Transcribed', 'Transcribed and transmitted live to receiving hospital.');
        }
      }
    } catch (err: any) {
      Alert.alert('Voice Processing Error', err.message || 'Could not transcribe voice note.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSendPatientNote = async () => {
    if (!activeEmergency || !patientNote.trim()) return;
    setIsUpdatingNote(true);
    try {
      await EmergenciesApi.updatePatientInfo(activeEmergency.id, {
        ...activeEmergency.patient_info,
        condition_description: patientNote.trim(),
      });
      await refreshActiveEmergency();
      Alert.alert('Transmitted to Hospital', 'Patient condition notes updated and visible to hospital triage.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not send patient note to hospital.');
    } finally {
      setIsUpdatingNote(false);
    }
  };

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
        {/* Step Progress Bar */}
        <View style={styles.stepBar}>
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted =
              activeEmergency.status === step.key ||
              (step.key === 'EN_ROUTE_SCENE' && ['ON_SCENE', 'EN_ROUTE_HOSPITAL', 'AT_HOSPITAL', 'HANDOVER_COMPLETED'].includes(activeEmergency.status)) ||
              (step.key === 'ON_SCENE' && ['EN_ROUTE_HOSPITAL', 'AT_HOSPITAL', 'HANDOVER_COMPLETED'].includes(activeEmergency.status)) ||
              (step.key === 'EN_ROUTE_HOSPITAL' && ['AT_HOSPITAL', 'HANDOVER_COMPLETED'].includes(activeEmergency.status));

            const isCurrent = activeEmergency.status === step.key;

            return (
              <View key={step.key} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isCurrent && styles.stepCircleCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNum,
                      (isCompleted || isCurrent) && styles.stepNumActive,
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

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

        {/* Live Patient Condition & Voice/Text Note */}
        <View style={styles.patientConditionCard}>
          <View style={styles.conditionHeader}>
            <View style={styles.conditionTitleRow}>
              <Activity size={18} color={Colors.primaryBlue} />
              <Text style={styles.conditionTitle}>Patient Condition & Field Notes</Text>
            </View>
            <View style={styles.conditionHeaderRight}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE TO HOSPITAL</Text>
              </View>
              <TouchableOpacity
                style={styles.collapseBtn}
                onPress={togglePatientCard}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={
                  patientCardCollapsed
                    ? 'Expand patient condition notes'
                    : 'Close patient condition notes'
                }
                activeOpacity={0.7}
              >
                {patientCardCollapsed ? (
                  <ChevronDown size={18} color={Colors.secondaryText} />
                ) : (
                  <ChevronUp size={18} color={Colors.secondaryText} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {patientCardCollapsed ? (
            <TouchableOpacity
              style={styles.collapsedHint}
              onPress={togglePatientCard}
              activeOpacity={0.7}
            >
              <Text style={styles.collapsedHintText}>
                Notes hidden. Tap to reopen and edit the latest field update.
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.conditionHint}>
                Describe current condition (conscious state, vitals, pain, injuries). Type or record voice note.
              </Text>

              <TextInput
                style={styles.conditionInput}
                multiline
                numberOfLines={3}
                placeholder="e.g. 52M, conscious, acute crushing chest pain radiating to left jaw, BP 140/90, SpO2 94%, given 325mg aspirin..."
                placeholderTextColor={Colors.secondaryText}
                value={patientNote}
                onChangeText={setPatientNote}
              />

              <View style={styles.conditionActionsRow}>
                {isRecording ? (
                  <TouchableOpacity
                    style={styles.recordingBtn}
                    onPress={stopVoiceNote}
                    activeOpacity={0.8}
                  >
                    <Square size={16} color="#FFFFFF" />
                    <Text style={styles.recordingBtnText}>
                      Stop & Transcribe ({recordDuration}s)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.voiceBtn}
                    onPress={startVoiceNote}
                    disabled={isTranscribing}
                    activeOpacity={0.8}
                  >
                    <Mic size={16} color={Colors.primaryBlue} />
                    <Text style={styles.voiceBtnText}>
                      {isTranscribing ? 'Transcribing...' : 'Record Voice'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.sendNoteBtn,
                    (!patientNote.trim() || isUpdatingNote) && styles.sendNoteBtnDisabled,
                  ]}
                  onPress={handleSendPatientNote}
                  disabled={!patientNote.trim() || isUpdatingNote}
                  activeOpacity={0.8}
                >
                  <Send size={15} color="#FFFFFF" />
                  <Text style={styles.sendNoteBtnText}>
                    {isUpdatingNote ? 'Sending...' : 'Send Live Update'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Paramedic Fast Action Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/emergency/ai-assessment')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: Colors.lightBlue }]}>
              <Mic size={20} color={Colors.primaryBlue} />
            </View>
            <Text style={styles.actionTitle}>Voice AI Assessment</Text>
            <Text style={Typography.caption}>ElevenLabs & Groq NLP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/emergency/handover')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: Colors.lightGreen }]}>
              <FileCheck size={20} color={Colors.medicalGreen} />
            </View>
            <Text style={styles.actionTitle}>Hospital Handover</Text>
            <Text style={Typography.caption}>Transfer Clinical Notes</Text>
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
