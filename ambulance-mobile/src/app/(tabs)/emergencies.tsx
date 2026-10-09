import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EmergenciesApi } from '../../api/emergencies';
import { Emergency, EmergencyStatus } from '../../types/emergency';
import { StatusBadge } from '../../components/StatusBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { AlertTriangle, Clock, MapPin } from 'lucide-react-native';

export default function EmergenciesScreen() {
  const router = useRouter();
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

  const renderItem = ({ item }: { item: Emergency }) => {
    const isCritical = item.severity_level === 'CRITICAL';
    const isCompleted = item.status === 'HANDOVER_COMPLETED';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/emergency/active')}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Text style={Typography.mono}>#{item.id.slice(0, 8)}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge
              label={item.severity_level}
              type={isCritical ? 'error' : 'warning'}
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

        <View style={styles.metaRow}>
          <Clock size={15} color={Colors.secondaryText} />
          <Text style={styles.metaText}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.patient_info?.chief_complaint && (
            <Text style={[styles.metaText, { marginLeft: Spacing.sm }]} numberOfLines={1}>
              • {item.patient_info.chief_complaint}
            </Text>
          )}
        </View>
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    ...Typography.bodySmall,
    marginLeft: 6,
    flex: 1,
  },
});
