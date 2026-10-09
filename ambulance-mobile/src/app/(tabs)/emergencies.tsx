import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useEmergency } from '../../context/EmergencyContext';
import { EmergenciesApi } from '../../api/emergencies';
import { Emergency } from '../../types/emergency';
import { StatusBadge } from '../../components/StatusBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  AlertTriangle,
  Clock,
  MapPin,
  Flame,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react-native';

export default function EmergenciesScreen() {
  const router = useRouter();
  const { ambulance } = useAuth();
  const { activeEmergency } = useEmergency();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setError(null);
      const res = await EmergenciesApi.getEmergencies(1, 30);
      setEmergencies(res.items);
    } catch (e: any) {
      setError(e.message || 'Failed to load emergencies.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchList();
  };

  const handleCardPress = (item: Emergency) => {
    if (activeEmergency?.id === item.id || (ambulance && item.assigned_ambulance_id === ambulance.id)) {
      router.push('/emergency/active');
    } else {
      Alert.alert(
        `Incident #${item.id.slice(0, 8)}`,
        `Severity: ${item.severity_level}\nStatus: ${item.status}\nLocation: ${item.location_description || 'Coordinates verified'}\n${
          item.patient_info?.chief_complaint ? `Complaint: ${item.patient_info.chief_complaint}\n` : ''
        }\n${item.assigned_ambulance_id ? 'Assigned to responding unit.' : 'Unassigned incident in queue.'}`
      );
    }
  };

  const renderItem = ({ item }: { item: Emergency }) => {
    const isCritical = item.severity_level === 'CRITICAL';
    const isCompleted = item.status === 'HANDOVER_COMPLETED';
    const isMyUnit = ambulance && item.assigned_ambulance_id === ambulance.id;
    const isCurrentActive = activeEmergency?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          (isMyUnit || isCurrentActive) && styles.cardActiveAssignment,
        ]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.8}
      >
        {(isMyUnit || isCurrentActive) && (
          <View style={styles.activeRibbon}>
            <ShieldCheck size={14} color="#FFFFFF" />
            <Text style={styles.activeRibbonText}>Assigned to Your Unit</Text>
          </View>
        )}

        <View style={styles.cardTop}>
          <View>
            <Text style={Typography.mono}>#{item.id.slice(0, 8)}</Text>
            <Text style={styles.timeText}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <StatusBadge
              label={item.severity_level}
              type={isCritical ? 'error' : item.severity_level === 'URGENT' ? 'warning' : 'neutral'}
            />
            <StatusBadge
              label={item.status}
              type={isCompleted ? 'success' : 'info'}
            />
          </View>
        </View>

        {item.location_description && (
          <View style={styles.metaRow}>
            <MapPin size={15} color={Colors.secondaryText} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location_description}
            </Text>
          </View>
        )}

        {item.latitude && item.longitude && (
          <View style={styles.metaRow}>
            <Text style={styles.coordText}>
              GPS: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          </View>
        )}

        {item.patient_info?.chief_complaint && (
          <View style={styles.complaintBox}>
            <Flame size={14} color={Colors.error} />
            <Text style={styles.complaintText} numberOfLines={1}>
              {item.patient_info.chief_complaint}
            </Text>
          </View>
        )}

        {(isMyUnit || isCurrentActive) && (
          <View style={styles.openMissionRow}>
            <Text style={styles.openMissionText}>Open Active Mission Details</Text>
            <ArrowRight size={14} color={Colors.primaryBlue} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Field Incidents" subtitle="Regional Emergency Triage Log" />

      {loading ? (
        <LoadingState message="Fetching emergencies..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchList} />
      ) : emergencies.length === 0 ? (
        <EmptyState
          title="No Active Field Incidents"
          description="There are currently no emergencies recorded in this sector."
          icon={<AlertTriangle size={36} color={Colors.primaryBlue} />}
        />
      ) : (
        <FlatList
          data={emergencies}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  listContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
  },
  cardActiveAssignment: {
    borderColor: Colors.primaryBlue,
    borderWidth: 1.5,
    backgroundColor: '#F0F9FF',
  },
  activeRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryBlue,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  activeRibbonText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    ...Typography.bodySmall,
    marginLeft: 6,
    flex: 1,
  },
  coordText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontFamily: Typography.mono.fontFamily,
  },
  complaintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    padding: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FEF2F2',
  },
  complaintText: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
    flex: 1,
  },
  openMissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borders,
  },
  openMissionText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
});
