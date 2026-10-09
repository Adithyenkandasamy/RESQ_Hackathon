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
} from 'lucide-react-native';
import { AmbulanceStatus } from '../../types/ambulance';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, ambulance, updateAvailability, logout, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: AmbulanceStatus) => {
    setUpdating(true);
    try {
      await updateAvailability(newStatus);
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update operational status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out this unit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

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

          <Text style={styles.sectionLabel}>UPDATE OPERATIONAL READINESS</Text>
          <View style={styles.statusButtonsRow}>
            {(['AVAILABLE', 'BUSY', 'OUT_OF_SERVICE'] as AmbulanceStatus[]).map((st) => {
              const isSelected = ambulance?.operational_status === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.statusOptionButton,
                    isSelected && styles.statusOptionActive,
                  ]}
                  onPress={() => handleStatusChange(st)}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  <Radio
                    size={14}
                    color={isSelected ? Colors.primaryBlue : Colors.secondaryText}
                  />
                  <Text
                    style={[
                      styles.statusOptionText,
                      isSelected && styles.statusOptionTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Crew Info Card */}
        <View style={styles.card}>
          <Text style={Typography.h3}>Crew Credentials</Text>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Mail size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Account Email:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Shield size={18} color={Colors.secondaryText} />
            <Text style={styles.infoLabel}>Role Privilege:</Text>
            <Text style={styles.infoValue}>{user?.role}</Text>
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
            <Text style={styles.infoLabel}>Verification Status:</Text>
            <StatusBadge label={user?.is_active ? 'ACTIVE' : 'INACTIVE'} type="success" />
          </View>
        </View>

        {/* Sign Out Button */}
        <AppButton
          title="Sign Out Unit Station"
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
  statusButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.base,
    borderWidth: 1.5,
    borderColor: Colors.borders,
    backgroundColor: '#FFFFFF',
  },
  statusOptionActive: {
    borderColor: Colors.primaryBlue,
    backgroundColor: Colors.lightBlue,
  },
  statusOptionText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.secondaryText,
  },
  statusOptionTextActive: {
    color: Colors.primaryBlue,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
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
    marginTop: Spacing.sm,
  },
});
