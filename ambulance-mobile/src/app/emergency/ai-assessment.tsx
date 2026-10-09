import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useEmergency } from '../../context/EmergencyContext';
import { EmergenciesApi } from '../../api/emergencies';
import { MediaService } from '../../services/media';
import { AppButton } from '../../components/AppButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  Mic,
  Square,
  Play,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Bot,
  ShieldAlert,
} from 'lucide-react-native';

export default function AIAssessmentScreen() {
  const { activeEmergency, refreshActiveEmergency } = useEmergency();

  // Audio Recording State
  const [recording, setRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [playing, setPlaying] = useState(false);

  // AI Pipeline State
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(
    activeEmergency?.transcription_text || null
  );
  const [clinicalEntities, setClinicalEntities] = useState<Record<string, any> | null>(
    activeEmergency?.clinical_entities || null
  );
  const [firstAidSteps, setFirstAidSteps] = useState<string[] | null>(null);
  const [verified, setVerified] = useState(false);

  if (!activeEmergency) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="AI Assessment" canGoBack />
        <View style={styles.emptyContainer}>
          <Text style={Typography.body}>No active emergency selected.</Text>
        </View>
      </View>
    );
  }

  const startRecording = async () => {
    const started = await MediaService.startAudioRecording();
    if (started) {
      setRecording(true);
      setAudioUri(null);
    } else {
      Alert.alert('Microphone Error', 'Could not access device microphone.');
    }
  };

  const stopRecording = async () => {
    const result = await MediaService.stopAudioRecording();
    setRecording(false);
    if (result) {
      setAudioUri(result.uri);
      setAudioDuration(result.durationMs);
    }
  };

  const playRecordedAudio = async () => {
    if (!audioUri) return;
    setPlaying(true);
    await MediaService.playAudio(audioUri, () => setPlaying(false));
  };

  const uploadAndProcessAI = async () => {
    if (!audioUri) {
      Alert.alert('Audio Required', 'Record a voice description before uploading.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Upload to ElevenLabs via backend
      const transRes = await EmergenciesApi.uploadAudio(activeEmergency.id, {
        uri: audioUri,
        name: 'scene_recording.m4a',
        type: 'audio/m4a',
      });
      setTranscription(transRes.transcription_text);

      // 2. Extract clinical entities with Groq
      if (transRes.transcription_text) {
        const extractRes = await EmergenciesApi.extractEntities(
          activeEmergency.id,
          transRes.transcription_text
        );
        setClinicalEntities(extractRes.extractions);
      }

      // 3. Obtain protocol-constrained first aid
      const firstAid = await EmergenciesApi.getFirstAidGuidance(
        activeEmergency.id,
        activeEmergency.patient_info?.chief_complaint || 'Trauma stabilization'
      );
      setFirstAidSteps(firstAid.steps);

      await refreshActiveEmergency();
    } catch (e: any) {
      Alert.alert('AI Processing Error', e.message || 'Speech or extraction pipeline failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyExtractions = async () => {
    if (!clinicalEntities) return;
    try {
      await EmergenciesApi.verifyExtractions(activeEmergency.id, clinicalEntities);
      setVerified(true);
      Alert.alert('Extractions Locked', 'Clinical observations verified into medical record.');
      await refreshActiveEmergency();
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Voice AI Assessment"
        subtitle={`Incident #${activeEmergency.id.slice(0, 8)}`}
        canGoBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Voice Recorder Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scene Audio Description</Text>
          <Text style={styles.cardSubtitle}>
            Record paramedic voice observations. Audio is transcribed via ElevenLabs Speech-to-Text.
          </Text>

          <View style={styles.recordRow}>
            {recording ? (
              <TouchableOpacity
                style={[styles.recordButton, styles.recordingActive]}
                onPress={stopRecording}
              >
                <Square size={22} color="#FFFFFF" />
                <Text style={styles.recordBtnText}>Stop Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={startRecording}
              >
                <Mic size={22} color="#FFFFFF" />
                <Text style={styles.recordBtnText}>
                  {audioUri ? 'Re-record Audio' : 'Start Voice Note'}
                </Text>
              </TouchableOpacity>
            )}

            {audioUri && !recording && (
              <TouchableOpacity
                style={styles.playButton}
                onPress={playRecordedAudio}
                disabled={playing}
              >
                <Play size={18} color={Colors.primaryBlue} />
                <Text style={styles.playButtonText}>
                  {playing ? 'Playing...' : `Play (${Math.round(audioDuration / 1000)}s)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {audioUri && (
            <AppButton
              title="Process Transcription & Extract AI"
              onPress={uploadAndProcessAI}
              loading={isProcessing}
              icon={<UploadCloud size={18} color="#FFFFFF" />}
              style={{ marginTop: Spacing.md }}
            />
          )}
        </View>

        {/* ElevenLabs Transcription Display */}
        {transcription && (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>ElevenLabs Scene Transcript</Text>
              <StatusBadge label="SPEECH-TO-TEXT" type="info" />
            </View>
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>"{transcription}"</Text>
            </View>
          </View>
        )}

        {/* Groq Clinical Entity Extraction Display */}
        {clinicalEntities && (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Bot size={20} color={Colors.primaryBlue} />
                <Text style={styles.cardTitle}>Groq Clinical Extraction</Text>
              </View>
              <StatusBadge
                label={verified ? 'VERIFIED' : 'UNCONFIRMED AI'}
                type={verified ? 'success' : 'warning'}
              />
            </View>

            <View style={styles.entitiesBox}>
              {Object.entries(clinicalEntities).map(([key, val]) => (
                <View key={key} style={styles.entityRow}>
                  <Text style={styles.entityKey}>{key.replace(/_/g, ' ')}:</Text>
                  <Text style={styles.entityVal}>
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </Text>
                </View>
              ))}
            </View>

            {!verified && (
              <AppButton
                title="Verify Clinical Observations"
                onPress={handleVerifyExtractions}
                variant="success"
                icon={<CheckCircle2 size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            )}
          </View>
        )}

        {/* Protocol-Constrained First Aid Advice */}
        {firstAidSteps && firstAidSteps.length > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ShieldAlert size={20} color={Colors.medicalGreen} />
              <Text style={styles.cardTitle}>Emergency Safety Protocol</Text>
            </View>

            {firstAidSteps.map((step, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{idx + 1}</Text>
                </View>
                <Text style={[Typography.bodySmall, { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}
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
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
    marginBottom: Spacing.base,
  },
  cardTitle: {
    ...Typography.h3,
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recordRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recordButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: Colors.primaryBlue,
    borderRadius: BorderRadius.base,
    gap: 8,
  },
  recordingActive: {
    backgroundColor: Colors.error,
  },
  recordBtnText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: Colors.lightBlue,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    gap: 6,
  },
  playButtonText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
  },
  transcriptText: {
    ...Typography.body,
    fontStyle: 'italic',
    color: Colors.primaryText,
  },
  entitiesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borders,
  },
  entityRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
  },
  entityKey: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.secondaryText,
    textTransform: 'uppercase',
    width: 130,
  },
  entityVal: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.medicalGreen,
  },
});
