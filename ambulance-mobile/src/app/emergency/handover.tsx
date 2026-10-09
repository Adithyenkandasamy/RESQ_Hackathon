import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEmergency } from '../../context/EmergencyContext';
import { EmergenciesApi } from '../../api/emergencies';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  Building2,
  FileCheck2,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';

export default function HandoverScreen() {
  const router = useRouter();
  const { activeEmergency, confirmedHospital, completeHandover } = useEmergency();

  const [handoverSummary, setHandoverSummary] = useState(
    activeEmergency?.handover_summary || ''
  );
  const [crewNotes, setCrewNotes] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!activeEmergency) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Patient Handover" canGoBack />
        <View style={styles.emptyContainer}>
          <Text style={Typography.body}>No active emergency to hand over.</Text>
        </View>
      </View>
    );
  }

  const generateAiDraft = async () => {
    setLoadingAi(true);
    try {
      const res = await EmergenciesApi.draftHandoverSummary(activeEmergency.id);
      setHandoverSummary(res.handover_summary);
    } catch (e: any) {
      Alert.alert('AI Drafting Failed', e.message || 'Could not generate clinical draft.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleFinalizeHandover = async () => {
    Alert.alert(
      'Confirm Patient Handover',
      'Are you sure you want to finalize the patient handover to hospital emergency staff? This will conclude the emergency response mission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize Handover',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const fullNotes = handoverSummary
                ? `${handoverSummary}\n\nCrew Notes: ${crewNotes}`
                : crewNotes;
              await completeHandover(fullNotes);
              Alert.alert('Mission Completed', 'Patient safely transferred to emergency department.', [
                {
                  text: 'Return to Base',
                  onPress: () => router.replace('/(tabs)/home'),
                },
              ]);
            } catch (err: any) {
              Alert.alert('Handover Failed', err.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Clinical Handover"
        subtitle={`Incident #${activeEmergency.id.slice(0, 8)}`}
        canGoBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Receiving Hospital Card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Building2 size={24} color={Colors.medicalGreen} />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <Text style={Typography.h3}>
                {confirmedHospital?.name || 'Assigned Hospital Facility'}
              </Text>
              <Text style={Typography.bodySmall}>
                {confirmedHospital?.address || 'Emergency Department'}
              </Text>
            </View>
            <StatusBadge label="RECEIVING FACILITY" type="success" />
          </View>
        </View>

        {/* Handover Summary & AI Drafting */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.cardTitle}>Structured Clinical Handover</Text>
            <TouchableOpacity
              style={styles.aiDraftBtn}
              onPress={generateAiDraft}
              disabled={loadingAi}
            >
              <Sparkles size={14} color={Colors.primaryBlue} />
              <Text style={styles.aiDraftBtnText}>
                {loadingAi ? 'Drafting...' : 'AI Draft (Groq)'}
              </Text>
            </TouchableOpacity>
          </View>

          <AppInput
            placeholder="Detailed clinical transfer summary (Patient vitals, observed condition, medications administered, ETA status)..."
            value={handoverSummary}
            onChangeText={setHandoverSummary}
            multiline
            numberOfLines={5}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          <AppInput
            label="Additional Paramedic Handover Notes"
            placeholder="Staff badge / receiving nurse handover notes..."
            value={crewNotes}
            onChangeText={setCrewNotes}
          />

          <AppButton
            title="Complete & Finalize Patient Transfer"
            onPress={handleFinalizeHandover}
            variant="success"
            loading={submitting}
            icon={<CheckCircle2 size={20} color="#FFFFFF" />}
            style={{ marginTop: Spacing.md }}
          />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  aiDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBlue,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  aiDraftBtnText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '600',
  },
});
