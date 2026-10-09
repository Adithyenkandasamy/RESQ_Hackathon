import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { ArrowLeft, ShieldAlert, Ambulance } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerCrew } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ambulanceIdentifier, setAmbulanceIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim() || !ambulanceIdentifier.trim()) {
      setErrorMessage('Please fill in email, password, and vehicle call sign.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await registerCrew({
        email: email.trim(),
        password,
        ambulance_identifier: ambulanceIdentifier.trim(),
        contact_number: contactNumber.trim() || undefined,
      });
      router.replace('/(tabs)/home');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Check network or email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Fixed Clean Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={Colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Crew & Vehicle Registration</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerInfo}>
          <View style={styles.iconBadge}>
            <Ambulance size={24} color={Colors.primaryBlue} />
          </View>
          <Text style={styles.mainTitle}>Register Unit</Text>
          <Text style={styles.subtitle}>
            Connect vehicle hardware and register paramedic credentials.
          </Text>
        </View>

        <View style={styles.card}>
          {errorMessage && (
            <View style={styles.errorBox}>
              <ShieldAlert size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <AppInput
            label="Ambulance Call Sign"
            placeholder="e.g. AMB-UNIT-305"
            value={ambulanceIdentifier}
            onChangeText={setAmbulanceIdentifier}
            autoCapitalize="characters"
          />

          <AppInput
            label="Paramedic Email"
            placeholder="paramedic@ercs.org"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <AppInput
            label="Unit Phone (Optional)"
            placeholder="+91-98765-43210"
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
          />

          <AppInput
            label="Password (min 8 chars)"
            placeholder="••••••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <AppInput
            label="Confirm Password"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
          />

          <AppButton
            title="Create Unit & Connect"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={Typography.bodySmall}>Already have registered credentials?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.mainBackground,
  },
  topBarTitle: {
    ...Typography.h3,
    fontSize: 16,
    color: Colors.primaryText,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl + 20,
  },
  headerInfo: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  mainTitle: {
    ...Typography.h2,
    fontSize: 20,
    color: Colors.darkNavy,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: Spacing.md,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.subtle,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.sm,
    height: 48,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.base,
    gap: Spacing.xs,
  },
  loginLink: {
    ...Typography.bodySmall,
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
});
