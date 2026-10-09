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
import { ShieldCheck, ShieldAlert } from 'lucide-react-native';

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
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandContainer}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={36} color="#FFFFFF" />
          </View>
          <Text style={Typography.h1}>Crew Onboarding</Text>
          <Text style={styles.subtitle}>Register Emergency Vehicle & Paramedic Crew</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unit Registration</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <ShieldAlert size={18} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <AppInput
            label="Vehicle Call Sign / Identifier"
            placeholder="e.g. AMB-UNIT-305"
            value={ambulanceIdentifier}
            onChangeText={setAmbulanceIdentifier}
            autoCapitalize="characters"
          />

          <AppInput
            label="Paramedic Email"
            placeholder="crew.member@ercs.org"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <AppInput
            label="Unit Contact Phone (Optional)"
            placeholder="+1-555-0305"
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
            title="Register Unit & Sign In"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={Typography.bodySmall}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borders,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.h2,
    marginBottom: Spacing.base,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  loginLink: {
    ...Typography.bodySmall,
    color: Colors.primaryBlue,
    fontWeight: '600',
  },
});
