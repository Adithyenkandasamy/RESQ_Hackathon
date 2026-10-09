import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
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
import { Clock, CheckCircle2, Building2, MapPin, HeartPulse } from 'lucide-react-native';

export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setError(null);
      const res = await EmergenciesApi.getEmergencies(1, 50);
      // Prioritize completed incidents and resolved handovers
      const completedOnly = res.items.filter(
        (e) => e.status === 'HANDOVER_COMPLETED' || e.status === 'CANCELLED' || e.status === 'AT_HOSPITAL'
      );
      // If none are specifically completed yet, display all recorded missions so the log isn't falsely empty
      setHistoryItems(completedOnly.length > 0 ? completedOnly : res.items);
    } catch (e: any) {
      setError(e.message || 'Failed to load emergency history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: Emergency }) => {
    const isCompleted = item.status === 'HANDOVER_COMPLETED';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={Typography.mono}>Incident #{item.id.slice(0, 8)}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </Text>
          </View>
          <StatusBadge
            label={item.status}
            type={isCompleted ? 'success' : item.status === 'CANCELLED' ? 'error' : 'info'}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <Text style={Typography.bodySmall}>Priority Level:</Text>
          <StatusBadge
            label={item.severity_level}
            type={item.severity_level === 'CRITICAL' ? 'error' : 'warning'}
          />
        </View>

        {item.location_description && (
          <View style={styles.metaRow}>
            <MapPin size={14} color={Colors.secondaryText} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location_description}
            </Text>
          </View>
        )}

        {item.patient_info?.chief_complaint && (
          <View style={styles.metaRow}>
            <HeartPulse size={14} color={Colors.secondaryText} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.patient_info.chief_complaint}
            </Text>
          </View>
        )}

        {item.confirmed_hospital_id && (
          <View style={styles.detailsRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Building2 size={15} color={Colors.medicalGreen} />
              <Text style={[Typography.bodySmall, { marginLeft: 4 }]}>Receiving Trauma Center:</Text>
            </View>
            <Text style={Typography.mono}>#{item.confirmed_hospital_id.slice(0, 8)}</Text>
          </View>
        )}

        {item.handover_summary && (
          <View style={styles.handoverBox}>
            <Text style={styles.handoverLabel}>Clinical Handover Summary:</Text>
            <Text style={styles.handoverText} numberOfLines={3}>
              {item.handover_summary}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Dispatched History" subtitle="Verified Field Response Audit" />

      {loading ? (
        <LoadingState message="Fetching shift audit log..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchHistory} />
      ) : historyItems.length === 0 ? (
        <EmptyState
          title="No History Logged"
          description="Completed field incidents and verified clinical handovers will appear here."
          icon={<Clock size={36} color={Colors.primaryBlue} />}
        />
      ) : (
        <FlatList
          data={historyItems}
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timestamp: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borders,
    marginVertical: Spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    flex: 1,
  },
  handoverBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.medicalGreen,
  },
  handoverLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.medicalGreen,
    marginBottom: 2,
  },
  handoverText: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    fontSize: 12,
  },
});
