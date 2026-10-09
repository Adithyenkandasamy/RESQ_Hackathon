import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Typography } from '../constants/typography';
import { AppButton } from './AppButton';
import { AlertCircle } from 'lucide-react-native';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <AlertCircle size={32} color={Colors.error} />
      </View>
      <Text style={styles.title}>Operation Failed</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <AppButton
          title="Try Again"
          onPress={onRetry}
          variant="outline"
          style={styles.retryButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    margin: Spacing.base,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    color: Colors.error,
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryButton: {
    height: 40,
    paddingHorizontal: Spacing.lg,
  },
});
